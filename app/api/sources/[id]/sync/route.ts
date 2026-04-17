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

async function syncGmail(
  sourceId: string,
  userId: string,
  accessToken: string,
  refreshToken: string | null
) {
  const authClient = await getGoogleClient(accessToken, refreshToken)
  const gmail = google.gmail({ version: 'v1', auth: authClient })

  const syncRun = await prisma.syncRun.create({
    data: { sourceId, userId, status: 'RUNNING', docsFound: 0, docsIndexed: 0, chunksCreated: 0 },
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

      let bodyText = ''
      const parts = detail.data.payload?.parts || []
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8').slice(0, 2000)
          break
        }
      }
      if (!bodyText && detail.data.payload?.body?.data) {
        bodyText = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8').slice(0, 2000)
      }

      if (!bodyText.trim()) continue

      const doc = await prisma.document.upsert({
        where: { sourceId_externalId: { sourceId, externalId: msg.id! } },
        update: { title: subject, bodyText, updatedAt: new Date() },
        create: {
          sourceId,
          externalId: msg.id!,
          title: subject,
          bodyText,
          snippet: bodyText.slice(0, 200),
          author: from,
          sourcedAt: date ? new Date(date) : new Date(),
        },
      })

      await prisma.chunk.deleteMany({ where: { documentId: doc.id } })
      const words = bodyText.split(' ')
      const chunkSize = 500
      const chunks: string[] = []
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '))
      }

      await prisma.chunk.createMany({
        data: chunks.map((text, idx) => ({
          documentId: doc.id,
          text,
          chunkIndex: idx,
        })),
      })

      docsIndexed++
      chunksCreated += chunks.length
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'SUCCESS',
        docsFound: messageIds.length,
        docsIndexed,
        chunksCreated,
        finishedAt: new Date(),
      },
    })

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'CONNECTED', lastSyncedAt: new Date() },
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

async function syncDrive(
  sourceId: string,
  userId: string,
  accessToken: string,
  refreshToken: string | null
) {
  const authClient = await getGoogleClient(accessToken, refreshToken)
  const drive = google.drive({ version: 'v3', auth: authClient })

  const syncRun = await prisma.syncRun.create({
    data: { sourceId, userId, status: 'RUNNING', docsFound: 0, docsIndexed: 0, chunksCreated: 0 },
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
      let bodyText = ''
      try {
        if (file.mimeType === 'application/vnd.google-apps.document') {
          const exported = await drive.files.export({
            fileId: file.id!,
            mimeType: 'text/plain',
          })
          bodyText = (exported.data as string).slice(0, 5000)
        } else {
          const downloaded = await drive.files.get({
            fileId: file.id!,
            alt: 'media',
          })
          bodyText = (downloaded.data as string).slice(0, 5000)
        }
      } catch {
        continue
      }

      if (!bodyText.trim()) continue

      const doc = await prisma.document.upsert({
        where: { sourceId_externalId: { sourceId, externalId: file.id! } },
        update: { title: file.name || 'Untitled', bodyText, updatedAt: new Date() },
        create: {
          sourceId,
          externalId: file.id!,
          title: file.name || 'Untitled',
          bodyText,
          snippet: bodyText.slice(0, 200),
          url: file.webViewLink,
          mimeType: file.mimeType,
          sourcedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
        },
      })

      await prisma.chunk.deleteMany({ where: { documentId: doc.id } })
      const words = bodyText.split(' ')
      const chunkSize = 500
      const chunks: string[] = []
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '))
      }

      await prisma.chunk.createMany({
        data: chunks.map((text, idx) => ({
          documentId: doc.id,
          text,
          chunkIndex: idx,
        })),
      })

      docsIndexed++
      chunksCreated += chunks.length
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'SUCCESS',
        docsFound: fileList.length,
        docsIndexed,
        chunksCreated,
        finishedAt: new Date(),
      },
    })

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: 'CONNECTED', lastSyncedAt: new Date() },
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

  // Get fresh tokens from account
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'google' },
  })

  if (!account?.access_token) {
    return NextResponse.json({ error: 'Google account not connected' }, { status: 400 })
  }

  try {
    let result
    if (source.type === 'GMAIL') {
      result = await syncGmail(
        source.id,
        session.user.id,
        account.access_token,
        account.refresh_token
      )
    } else if (source.type === 'GOOGLE_DRIVE') {
      result = await syncDrive(
        source.id,
        session.user.id,
        account.access_token,
        account.refresh_token
      )
    } else {
      return NextResponse.json({ error: 'Unsupported source type' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
