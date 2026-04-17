import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question } = await req.json()
  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  const userId = session.user.id

  // Search for relevant document chunks
  const chunks = await prisma.chunk.findMany({
    where: {
      document: {
        source: { userId },
      },
    },
    include: {
      document: {
        include: { source: true },
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  // Build context from chunks
  const context = chunks
    .map((c) => `[${c.document.title} - ${c.document.source.type}]\n${c.text}`)
    .join('\n\n')

  const systemPrompt = context
    ? `You are a helpful assistant that answers questions based on the user's workspace documents.\n\nContext from workspace:\n${context}\n\nAnswer the user's question based on the context above. If the answer is not in the context, say so.`
    : `You are a helpful assistant for a workspace tool called Desk Drawer. The user has not connected any sources yet. Encourage them to connect Gmail or Google Drive to get started.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    max_tokens: 1000,
  })

  const answer = completion.choices[0]?.message?.content || 'No response generated.'

  // Build citations
  const citations = chunks.slice(0, 3).map((c) => ({
    documentId: c.document.id,
    title: c.document.title,
    sourceType: c.document.source.type,
    sourcedAt: c.document.sourcedAt?.toISOString() || null,
    url: c.document.url,
    snippet: c.text.slice(0, 200),
  }))

  return NextResponse.json({ answer, citations })
}
