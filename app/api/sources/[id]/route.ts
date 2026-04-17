import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
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

  await prisma.source.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = await prisma.source.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      _count: { select: { documents: true } },
      syncRuns: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  })

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }

  return NextResponse.json({ source })
}
