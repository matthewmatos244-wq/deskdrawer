import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { SourceType } from '@prisma/client'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [sources, recentDocs, stats] = await Promise.all([
    prisma.source.findMany({ where: { userId } }),
    prisma.document.findMany({
      where: { source: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { source: true },
    }),
    prisma.document.count({ where: { source: { userId } } }),
  ])

  const gmailSource = sources.find((s) => s.type === SourceType.GMAIL)
  const driveSource = sources.find((s) => s.type === SourceType.GOOGLE_DRIVE)

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of your workspace memory</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Documents indexed', value: stats },
          { label: 'Sources connected', value: sources.length },
          { label: 'Sources available', value: 2 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Source status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Sources</h3>
        <div className="space-y-3">
          {[
            { type: SourceType.GMAIL, label: 'Gmail', source: gmailSource },
            { type: SourceType.GOOGLE_DRIVE, label: 'Google Drive', source: driveSource },
          ].map(({ label, source }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${source ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                {source?.lastSyncedAt && (
                  <span className="text-xs text-gray-400">
                    Last sync: {new Date(source.lastSyncedAt).toLocaleDateString()}
                  </span>
                )}
                <Link href="/app/sources" className="text-xs text-blue-600 hover:underline">
                  {source ? 'Manage' : 'Connect'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent items */}
      {recentDocs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recently indexed</h3>
          <div className="space-y-2">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-400">
                    {doc.source.type === SourceType.GMAIL ? 'Gmail' : 'Drive'} &middot;{' '}
                    {doc.sourcedAt ? new Date(doc.sourcedAt).toLocaleDateString() : ''}
                  </p>
                  {doc.snippet && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.snippet}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No documents indexed yet.</p>
          <Link href="/app/sources" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Connect a source to get started
          </Link>
        </div>
      )}
    </div>
  )
}
