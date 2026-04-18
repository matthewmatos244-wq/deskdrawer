import { SourceType } from '@prisma/client'
import { Mail, FileText, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SourceIconProps {
  type: SourceType
  className?: string
}

export function SourceIcon({ type, className }: SourceIconProps) {
  switch (type) {
    case SourceType.GMAIL:
      return <Mail className={cn('h-4 w-4', className)} />
    case SourceType.GOOGLE_DRIVE:
      return <HardDrive className={cn('h-4 w-4', className)} />
    default:
      return <FileText className={cn('h-4 w-4', className)} />
  }
}

export function getSourceName(type: SourceType): string {
  switch (type) {
    case SourceType.GMAIL:
      return 'Gmail'
    case SourceType.GOOGLE_DRIVE:
      return 'Google Drive'
    default:
      return 'Unknown'
  }
}
