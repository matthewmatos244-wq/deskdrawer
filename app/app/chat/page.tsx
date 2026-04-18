'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, ExternalLink, FileText, Loader2, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SourceIcon, getSourceName } from '@/components/source-icon'
import { samplePrompts, mockDocuments } from '@/lib/mock-data'
import type { Citation, ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <Card className="overflow-hidden border border-border bg-card">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
              <SourceIcon type={citation.sourceType} className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              {getSourceName(citation.sourceType)}
            </Badge>
          </div>
          {citation.sourceUrl && (
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <h4 className="mt-2 text-sm font-medium leading-tight">{citation.title}</h4>
        {citation.author && (
          <p className="mt-1 text-xs text-muted-foreground">{citation.author}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{citation.snippet}</p>
        {citation.matchingExcerpt && (
          <div className="mt-2 rounded bg-muted/50 px-2 py-1.5 text-xs">
            <span className="font-medium text-foreground">&ldquo;</span>
            <span className="text-foreground/80">{citation.matchingExcerpt}</span>
            <span className="font-medium text-foreground">&rdquo;</span>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {formatRelativeTime(citation.timestamp)}
        </p>
      </div>
    </Card>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'max-w-2xl rounded-lg px-4 py-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <h2 className="text-lg font-medium">Ask DeskDrawer</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Search your work memory with natural language
      </p>
      <div className="mt-6 grid w-full max-w-lg gap-2">
        {samplePrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptClick(prompt)}
            className="rounded-md border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

const mockCitations: Citation[] = mockDocuments.slice(0, 3).map((doc) => ({
  id: doc.id,
  documentId: doc.id,
  sourceType: doc.sourceType,
  title: doc.title,
  snippet: doc.snippet,
  author: doc.author,
  timestamp: doc.updatedAt,
  matchingExcerpt: doc.snippet.substring(0, 100),
  sourceUrl: doc.sourceUrl,
}))

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCitations, setShowCitations] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition =
          (window as unknown as { SpeechRecognition: typeof window.SpeechRecognition })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition })
            .webkitSpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join('')
          setInput(transcript)
        }
        recognitionRef.current.onend = () => setIsListening(false)
        recognitionRef.current.onerror = () => setIsListening(false)
      }
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Based on my search of your work memory, I found several relevant items related to "${query}". In your emails and documents, it appears that the main discussion points were around prioritization and timing. Sarah mentioned in her email that the team should focus on customer feedback-driven improvements, particularly around search functionality. The Product Requirements Document also outlines key objectives including improving search relevance by 40%. This aligns with the feedback summary from March which showed that better search was the top customer request.`,
        citations: mockCitations,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setShowCitations(true)
      setIsLoading(false)
    }, 1500)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {!hasMessages ? (
        <EmptyState onPromptClick={handleSubmit} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isLoading && (
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Searching your memory...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {showCitations && (
            <aside className="w-80 border-l border-border bg-muted/30 p-4 overflow-y-auto">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Sources</h3>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {mockCitations.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {mockCitations.map((citation) => (
                  <CitationCard key={citation.id} citation={citation} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      <div className="border-t border-border bg-background p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit(input)
          }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your work..."
              className="h-11 w-full rounded-md border border-input bg-background px-4 pr-12 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant={isListening ? 'default' : 'outline'}
            className={cn(
              'h-11 w-11',
              isListening && 'bg-destructive hover:bg-destructive/90'
            )}
            onClick={toggleListening}
            disabled={
              isLoading ||
              !(
                'SpeechRecognition' in globalThis ||
                'webkitSpeechRecognition' in globalThis
              )
            }
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Answers are grounded in your indexed documents and emails
        </p>
      </div>
    </div>
  )
}
