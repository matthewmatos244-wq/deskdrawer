import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { embedText } from '@/lib/embed'

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly'

async function fetchGmailMessages(accessToken: string) {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:inbox',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error('Failed to fetch Gmail messages')
  const listData = await listRes.json()
  const messages = listData.messages || []

  const docs = []
  for (const msg of messages.slice(0, 20)) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!msgRes.ok) continue
    const msgData = await msgRes.json()
    const headers = msgData.payload?.headers || []
    const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(no subject)'
    const from = headers.find((h: { name: string }) => h.name === 'From')?.value || ''
    const date = headers.find((h: { name: string }) => h.name === 'Date')?.value || ''
    const snippet = msgData.snippet || ''

    docs.push({
      externalId: msg.id,
      sourceType: 'GMAIL' as const,
      title: subject,
      snippet: snippet.slice(0, 500),
      author: from,
      origin: 'Gmail',
      updatedAt: date ? new Date(date) : new Date(),
      sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    })
  }
  return docs
}

async function fetchDriveFiles(accessToken: string) {
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,modifiedTime,owners,webViewLink,description)&orderBy=modifiedTime+desc',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error('Failed to fetch Drive files')
  const listData = await listRes.json()
  const files = listData.files || []

  return files.map((file: {
    id: string
    name: string
    mimeType: string
    modifiedTime: string
    owners?: Array<{ displayName: string }>
    webViewLink?: string
    description?: string
  }) => ({
    externalId: file.id,
    sourceType: 'GOOGLE_DRIVE' as const,
    title: file.name,
    snippet: file.description || `${file.mimeType} file`,
    author: file.owners?.[0]?.displayName || '',
    origin: 'Google Drive',
    updatedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    sourceUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}`,
  }))
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const sources: string[] = body.sources || ['gmail', 'drive']

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    })

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No Google account connected' },
        { status: 400 }
      )
    }

    const accessToken = account.access_token
    let synced = 0
    const errors: string[] = []

    const allDocs: Array<{
      externalId: string
      sourceType: 'GMAIL' | 'GOOGLE_DRIVE'
      title: string
      snippet: string
      author: string
      origin: string
      updatedAt: Date
      sourceUrl: string
    }> = []

    if (sources.includes('gmail')) {
      try {
        const gmailDocs = await fetchGmailMessages(accessToken)
        allDocs.push(...gmailDocs)
      } catch (err) {
        errors.push(`Gmail sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    if (sources.includes('drive')) {
      try {
        const driveDocs = await fetchDriveFiles(accessToken)
        allDocs.push(...driveDocs)
      } catch (err) {
        errors.push(`Drive sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    for (const doc of allDocs) {
      try {
        const embedding = await embedText(`${doc.title} ${doc.snippet}`)

        await prisma.document.upsert({
          where: {
            userId_externalId: {
              userId: session.user.id,
              externalId: doc.externalId,
            },
          },
          update: {
            title: doc.title,
            snippet: doc.snippet,
            author: doc.author,
            origin: doc.origin,
            updatedAt: doc.updatedAt,
            sourceUrl: doc.sourceUrl,
            embedding,
          },
          create: {
            userId: session.user.id,
            externalId: doc.externalId,
            sourceType: doc.sourceType,
            title: doc.title,
            snippet: doc.snippet,
            author: doc.author,
            origin: doc.origin,
            updatedAt: doc.updatedAt,
            sourceUrl: doc.sourceUrl,
            embedding,
          },
        })
        synced++
      } catch (err) {
        errors.push(`Failed to save ${doc.title}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    await prisma.connectedSource.updateMany({
      where: {
        userId: session.user.id,
        sourceType: { in: sources.map((s) => s.toUpperCase()) },
      },
      data: { lastSyncedAt: new Date() },
    })

    return NextResponse.json({
      synced,
      total: allDocs.length,
      errors,
      message: `Synced ${synced} documents`,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sources = await prisma.connectedSource.findMany({
      where: { userId: session.user.id },
      select: {
        sourceType: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    })

    const docCounts = await prisma.document.groupBy({
      by: ['sourceType'],
      where: { userId: session.user.id },
      _count: { id: true },
    })

    const result = sources.map((s) => ({
      sourceType: s.sourceType,
      lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
      connectedAt: s.createdAt.toISOString(),
      documentCount: docCounts.find((d) => d.sourceType === s.sourceType)?._count?.id ?? 0,
    }))

    return NextResponse.json({ sources: result })
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
  }
}
