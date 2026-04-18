import { SourceType } from '@prisma/client'
import type { Document } from '@/lib/types'

export const samplePrompts = [
  'What did Sarah say about the product roadmap?',
  'Find emails about the Q2 budget proposal',
  'What are the key action items from last week?',
  'Summarize the onboarding documents',
  'Show me recent files about customer feedback',
]

export const mockDocuments: Document[] = [
  {
    id: '1',
    sourceType: SourceType.GMAIL,
    title: 'Re: Q2 Product Roadmap Planning',
    snippet: 'Hi team, following up on our discussion about the Q2 roadmap. The main priorities should be improving search relevance and adding bulk export functionality.',
    author: 'Sarah Chen',
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    sourceUrl: 'https://mail.google.com',
  },
  {
    id: '2',
    sourceType: SourceType.GOOGLE_DRIVE,
    title: 'Product Requirements Document v2.1',
    snippet: 'This document outlines the key objectives and requirements for the upcoming product release. Key goals include: improving search relevance by 40%, reducing load time by 30%.',
    author: 'Product Team',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    sourceUrl: 'https://docs.google.com',
  },
  {
    id: '3',
    sourceType: SourceType.GMAIL,
    title: 'Customer Feedback Summary - March 2024',
    snippet: 'Summary of customer feedback received in March. Top requests: better search (42%), more integrations (31%), improved mobile experience (27%).',
    author: 'Alex Rivera',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    sourceUrl: 'https://mail.google.com',
  },
  {
    id: '4',
    sourceType: SourceType.GOOGLE_DRIVE,
    title: 'Team Meeting Notes - Sprint Planning',
    snippet: 'Sprint goals: finalize API integration, complete UI redesign for dashboard, write unit tests for core modules. Blockers: waiting on design assets.',
    author: 'Engineering Team',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    sourceUrl: 'https://docs.google.com',
  },
  {
    id: '5',
    sourceType: SourceType.GMAIL,
    title: 'Budget Approval Request - Q2 2024',
    snippet: 'Please review and approve the attached Q2 budget proposal. Total requested: $450K, including $200K for new hires and $150K for infrastructure.',
    author: 'Finance Team',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    sourceUrl: 'https://mail.google.com',
  },
]
