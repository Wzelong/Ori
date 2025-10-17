import Dexie, { type EntityTable } from 'dexie'

export interface Page {
  id?: number
  url: string
  title: string
  content: string
  summary?: string
  timestamp: number
  favicon?: string
  tags?: string[]
}

export interface Video {
  id?: number
  url: string
  title: string
  videoId: string
  transcript?: string
  summary?: string
  timestamp: number
  duration?: number
  thumbnail?: string
}

export interface Note {
  id?: number
  pageId?: number
  videoId?: number
  content: string
  timestamp: number
}

export interface Tag {
  id?: number
  name: string
  color?: string
}

const db = new Dexie('TraceDB') as Dexie & {
  pages: EntityTable<Page, 'id'>
  videos: EntityTable<Video, 'id'>
  notes: EntityTable<Note, 'id'>
  tags: EntityTable<Tag, 'id'>
}

db.version(1).stores({
  pages: '++id, url, title, timestamp, *tags',
  videos: '++id, url, videoId, title, timestamp',
  notes: '++id, pageId, videoId, timestamp',
  tags: '++id, name',
})

export { db }
