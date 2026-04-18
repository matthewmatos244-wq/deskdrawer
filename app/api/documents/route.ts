import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { mockDocuments } from '@/lib/mock-data'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { documents: mockDocuments },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (source && source !== 'all') {
      where.sourceType = source
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          sourceType: true,
          title: true,
          snippet: true,
          author: true,
          origin: true,
          updatedAt: true,
          sourceUrl: true,
        },
      }),
      prisma.document.count({ where }),
    ])

    return NextResponse.json({
      documents: documents.map((doc) => ({
        ...doc,
        updatedAt: doc.updatedAt?.toISOString() ?? null,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json(
      { documents: mockDocuments, error: 'Failed to fetch documents' },
      { status: 200 }
    )
  }
}
