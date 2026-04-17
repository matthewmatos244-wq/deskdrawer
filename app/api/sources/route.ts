import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SourceType } from '@prisma/client'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sources = await prisma.source.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ sources })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type } = await req.json()
  if (!type || !Object.values(SourceType).includes(type)) {
    return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
  }

  // Check if source already exists
  const existing = await prisma.source.findFirst({
    where: { userId: session.user.id, type },
  })

  if (existing) {
    return NextResponse.json({ error: 'Source already connected' }, { status: 409 })
  }

  const source = await prisma.source.create({
    data: {
      userId: session.user.id,
      type: type as SourceType,
      status: 'CONNECTED',
    },
  })

  return NextResponse.json({ source }, { status: 201 })
}
