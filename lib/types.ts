import { SourceType } from '@prisma/client'

export type { SourceType }

export interface Citation {
  id: string
  documentId: string
  sourceType: SourceType
  title: string
  snippet: string
  author?: string
  timestamp: string
  matchingExcerpt?: string
  sourceUrl?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  createdAt: string
}

export interface Document {
  id: string
  sourceType: SourceType
  title: string
  snippet: string
  author?: string
  origin?: string
  updatedAt: string
  sourceUrl?: string
  content?: string
  chunkCount: number
}

export interface Source {
  id: string
  type: SourceType
  email?: string
  syncedAt?: string
  totalDocuments?: number
  status: 'active' | 'syncing' | 'error' | 'disconnected'
}
