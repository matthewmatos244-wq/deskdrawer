'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SourceIcon } from '@/components/source-icon'
import { mockDocuments } from '@/lib/mock-data'
import type { Document } from '@/lib/types'
import type { SourceType } from '@prisma/client'
import { FileText, ExternalLink, Search, X } from 'lucide-react'

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {hasFilters ? 'No documents match your filters' : 'No documents yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'Connect Gmail or Google Drive in Sources to start syncing your documents.'}
      </p>
    </div>
  )
}

function DocumentDetail({ document, onClose }: { document: Document; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <SourceIcon type={document.sourceType as SourceType} className="h-5 w-5 flex-shrink-0" />
              <Badge variant="secondary" className="text-xs">
                {document.sourceType}
              </Badge>
            </div>
            <CardTitle className="text-base leading-tight">{document.title}</CardTitle>
            {document.author && (
              <p className="text-sm text-muted-foreground mt-1">From: {document.author}</p>
            )}
            {document.updatedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(document.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Snippet</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{document.snippet}</p>
          </div>
          {document.origin && (
            <div>
              <h4 className="text-sm font-medium mb-1">Source</h4>
              <p className="text-sm text-muted-foreground">{document.origin}</p>
            </div>
          )}
          {document.sourceUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-2" />
                Open original
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentRow({
  document,
  onClick,
}: {
  document: Document
  onClick: () => void
}) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="pb-3 pr-4 pt-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          <SourceIcon type={document.sourceType as SourceType} className="h-4 w-4 flex-shrink-0" />
          <span className="truncate max-w-[200px]">{document.title}</span>
        </div>
      </td>
      <td className="pb-3 pr-4 pt-3 text-sm text-muted-foreground">
        <Badge variant="outline" className="text-xs font-normal">
          {document.sourceType}
        </Badge>
      </td>
      <td className="pb-3 pr-4 pt-3 text-sm text-muted-foreground">
        {document.author || '—'}
      </td>
      <td className="pb-3 pr-4 pt-3 text-sm text-muted-foreground">
        {document.updatedAt
          ? new Date(document.updatedAt).toLocaleDateString()
          : '—'}
      </td>
      <td className="pb-3 pt-3 text-sm text-muted-foreground font-mono">
        <ExternalLink className="h-3 w-3" />
      </td>
    </tr>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'GMAIL' | 'GOOGLE_DRIVE'>('all')
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents')
        if (res.ok) {
          const data = await res.json()
          setDocuments(data.documents || [])
        } else {
          setDocuments(mockDocuments)
        }
      } catch {
        setDocuments(mockDocuments)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.snippet.toLowerCase().includes(search.toLowerCase()) ||
      (doc.author && doc.author.toLowerCase().includes(search.toLowerCase()))
    const matchesFilter = filter === 'all' || doc.sourceType === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {loading ? 'Loading...' : `${documents.length} documents synced`}
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'GMAIL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('GMAIL')}
              >
                <SourceIcon type={'GMAIL' as SourceType} className="h-3 w-3 mr-1" />
                Gmail
              </Button>
              <Button
                variant={filter === 'GOOGLE_DRIVE' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('GOOGLE_DRIVE')}
              >
                <SourceIcon type={'GOOGLE_DRIVE' as SourceType} className="h-3 w-3 mr-1" />
                Drive
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDocs.length === 0 ? (
            <EmptyState hasFilters={!!search || filter !== 'all'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 text-left text-xs font-medium text-muted-foreground">Title</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium text-muted-foreground">Source</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium text-muted-foreground">Author</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium text-muted-foreground">Date</th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <DocumentRow key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {selectedDoc && <DocumentDetail document={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  )
}
