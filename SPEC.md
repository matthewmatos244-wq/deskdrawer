# deskdrawer — Product Specification

## Overview

deskdrawer is a personal project and note-storage application designed to give users a single, organized place to keep drafts, ideas, files, and quick notes — like a digital desk drawer.

---

## Goals

- Provide a simple, fast interface for storing and retrieving personal notes and files
- Support tagging and categorization for easy organization
- Enable search across all stored content
- Offer a clean, distraction-free UI

---

## Non-Goals

- Real-time collaboration (not in v1)
- Public sharing of content
- Mobile-native app (web-first for now)

---

## Features

### v1 (MVP)

| Feature | Description |
|---|---|
| Note creation | Create plain-text or markdown notes |
| File attachments | Attach files to notes |
| Tagging | Add tags to notes for organization |
| Search | Full-text search across all notes |
| Archive | Archive notes without deleting them |

### Future Versions

- AI-powered note summarization
- Reminders / due dates on notes
- Browser extension for quick capture
- Mobile PWA support

---

## Tech Stack

- **Frontend**: Next.js (TypeScript)
- **Backend**: Python (FastAPI) or Next.js API routes
- **Database**: PostgreSQL
- **Storage**: AWS S3 (file attachments)
- **Auth**: GitHub OAuth / NextAuth
- **Deployment**: Vercel (frontend), Railway (backend)

---

## User Stories

1. As a user, I can create a new note from the dashboard in under 5 seconds.
2. As a user, I can attach a file to a note and download it later.
3. As a user, I can tag notes and filter by tag.
4. As a user, I can search all my notes by keyword.
5. As a user, I can archive notes I no longer need without losing them.

---

## Success Metrics

- Notes created per session > 2
- Search returns results in < 500ms
- Zero data loss incidents
- User retention rate > 60% at 30 days

---

## Open Questions

- [ ] Should notes support rich text (WYSIWYG) or markdown only?
- [ ] What is the storage limit per user in v1?
- [ ] Do we need end-to-end encryption for stored content?

---

*Last updated: April 16, 2026*
