import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'

async function getGoogleClient(accessToken: string, refreshToken: string | null) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return oauth2Client
}

async function syncGmail(sourceId: string, accessToken: string, refreshToken: string | null) {
  const auth = await getGoogleClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth })

  const syncRun = await prisma.syncRun.create({
    data: { sourceId, status: 'RUNNING', docsFound: 0, docsIndexed: 0, chunksCreated: 0 },
  })

  try {
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'in:inbox -category:promotions -category:social',
    })

    const messageIds = messages.data.messages || []
    let docsIndexed = 0
    let chunksCreated = 0

    for (const msg of messageIds.slice(0, 20)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })

      const headers = detail.data.payload?.headers || []
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(No Subject)'
      const from = headers.find((h) => h.name === 'From')?.value || ''
      const date = headers.find((h) => h.name === 'Date')?.value || ''

      let body = ''
      const parts = detail.data.payload?.parts || []
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8').slice(0, 2000)
          break
        }
      }
      if (!body && detail.data.payload?.body?.data) {
        body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8').slice(0, 2000)
      }

      if (!body.trim()) continue

      const doc = await prisma.document.upsert({
        where: { externalId: msg.id! },
        update: { title: subject, content: body, updatedAt: new Date() },
        create: {
          sourceId,
          externalId: msg.id!,
          title: subject,
          content: body,
          metadata: { from, date },
        },
      })

      // Delete old chunks and create new ones
      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } })
      const chunkSize = 500
      const words = body.split(' ')
      const chunks: string[] = []
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '))
      }

      await prisma.documentChunk.createMany({
        data: chunks.map((content, idx) => ({
          documentId: doc.id,
          content,
          chunkIndex: idx,
        })),
      })

      docsIndexed++
      chunksCreated += chunks.length
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'COMPLETED',
        docsFound: messageIds.length,
        docsIndexed,
        chunksCreated,
        finishedAt: new Date(),
      },
    })

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'ACTIVE', lastSyncedAt: new Date() },
    })

    return { docsFound: messageIds.length, docsIndexed, chunksCreated }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: 'FAILED', error: message, finishedAt: new Date() },
    })
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'ERROR' },
    })
    throw error
  }
}

async function syncDrive(sourceId: string, accessToken: string, refreshToken: string | null) {
  const auth = await getGoogleClient(accessToken, refreshToken)
  const drive = google.drive({ version: 'v3', auth })

  const syncRun = await prisma.syncRun.create({
    data: { sourceId, status: 'RUNNING', docsFound: 0, docsIndexed: 0, chunksCreated: 0 },
  })

  try {
    const files = await drive.files.list({
      pageSize: 50,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      q: "mimeType='application/vnd.google-apps.document' or mimeType='text/plain'",
    })

    const fileList = files.data.files || []
    let docsIndexed = 0
    let chunksCreated = 0

    for (const file of fileList.slice(0, 20)) {
      let content = ''
      try {
        if (file.mimeType === 'application/vnd.google-apps.document') {
          const exported = await drive.files.export({
            fileId: file.id!,
            mimeType: 'text/plain',
          })
          content = (exported.data as string).slice(0, 5000)
        } else {
          const downloaded = await drive.files.get({
            fileId: file.id!,
            alt: 'media',
          })
          content = (downloaded.data as string).slice(0, 5000)
        }
      } catch {
        continue
      }

      if (!content.trim()) continue

      const doc = await prisma.document.upsert({
        where: { externalId: file.id! },
        update: { title: file.name || 'Untitled', content, updatedAt: new Date() },
        create: {
          sourceId,
          externalId: file.id!,
          title: file.name || 'Untitled',
          content,
          url: file.webViewLink,
          metadata: { mimeType: file.mimeType, modifiedTime: file.modifiedTime },
        },
      })

      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } })
      const chunkSize = 500
      const words = content.split(' ')
      const chunks: string[] = []
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '))
      }

      await prisma.documentChunk.createMany({
        data: chunks.map((c, idx) => ({
          documentId: doc.id,
          content: c,
          chunkIndex: idx,
        })),
      })

      docsIndexed++
      chunksCreated += chunks.length
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'COMPLETED',
        docsFound: fileList.length,
        docsIndexed,
        chunksCreated,
        finishedAt: new Date(),
      },
    })

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'ACTIVE', lastSyncedAt: new Date() },
    })

    return { docsFound: fileList.length, docsIndexed, chunksCreated }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: 'FAILED', error: message, finishedAt: new Date() },
    })
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'ERROR' },
    })
    throw error
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = await prisma.source.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }

  if (source.status === 'SYNCING') {
    return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 })
  }

  await prisma.source.update({
    where: { id: source.id },
    data: { status: 'SYNCING' },
  })

  try {
    let result
    if (source.type === 'GMAIL') {
      result = await syncGmail(source.id, source.accessToken, source.refreshToken)
    } else if (source.type === 'GOOGLE_DRIVE') {
      result = await syncDrive(source.id, source.accessToken, source.refreshToken)
    } else {
      return NextResponse.json({ error: 'Unsupported source type' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
