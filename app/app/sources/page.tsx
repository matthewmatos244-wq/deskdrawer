'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Source = {
  id: string
  type: string
  status: string
  lastSyncedAt: string | null
  _count?: { documents: number }
}

type SyncRun = {
  id: string
  status: string
  docsFound: number
  docsIndexed: number
  chunksCreated: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export default function SourcesPage() {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>([])
  const [syncRuns, setSyncRuns] = useState<Record<string, SyncRun[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [loaded, setLoaded] = useState(false)

  const loadSources = async () => {
    const res = await fetch('/api/sources')
    const data = await res.json()
    setSources(data.sources)
    setLoaded(true)
  }

  if (!loaded) {
    loadSources()
  }

  const connectSource = async (type: 'GMAIL' | 'GOOGLE_DRIVE') => {
    setLoading((l) => ({ ...l, [type]: true }))
    await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
    await loadSources()
    setLoading((l) => ({ ...l, [type]: false }))
  }

  const syncSource = async (sourceId: string, type: string) => {
    setLoading((l) => ({ ...l, [sourceId]: true }))
    const res = await fetch(`/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }) })
    const data = await res.json()
    setSyncRuns((r) => ({ ...r, [sourceId]: [data.syncRun, ...(r[sourceId] || [])] }))
    await loadSources()
    setLoading((l) => ({ ...l, [sourceId]: false }))
    router.refresh()
  }

  const gmailSource = sources.find((s) => s.type === 'GMAIL')
  const driveSource = sources.find((s) => s.type === 'GOOGLE_DRIVE')

  const SourceCard = ({ label, type, source }: { label: string; type: 'GMAIL' | 'GOOGLE_DRIVE'; source?: Source }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-900">{label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {source ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                Connected{source.lastSyncedAt ? ` · Last sync ${new Date(source.lastSyncedAt).toLocaleString()}` : ''}
              </>
            ) : 'Not connected'}
          </p>
          {source?._count && (
            <p className="text-xs text-gray-500 mt-1">{source._count.documents} documents indexed</p>
          )}
        </div>
        <div className="flex gap-2">
          {!source ? (
            <button
              onClick={() => connectSource(type)}
              disabled={loading[type]}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading[type] ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={() => syncSource(source.id, type)}
              disabled={loading[source.id]}
              className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading[source.id] ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
      </div>

      {/* Recent sync runs */}
      {source && syncRuns[source.id]?.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Recent sync runs</p>
          <div className="space-y-1.5">
            {syncRuns[source.id].slice(0, 3).map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-xs text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  run.status === 'SUCCESS' ? 'bg-green-500' :
                  run.status === 'RUNNING' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'
                }`} />
                <span>{run.status}</span>
                <span>{run.docsIndexed} indexed</span>
                <span>{run.chunksCreated} chunks</span>
                {run.error && <span className="text-red-500 truncate">{run.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sources</h2>
        <p className="text-sm text-gray-500 mt-1">Connect and sync your data sources</p>
      </div>
      <div className="space-y-4">
        <SourceCard label="Gmail" type="GMAIL" source={gmailSource} />
        <SourceCard label="Google Drive" type="GOOGLE_DRIVE" source={driveSource} />
      </div>
    </div>
  )
}
