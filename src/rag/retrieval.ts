import { db } from '@/db/db'

export interface SearchResult {
  id: number
  title: string
  content: string
  url: string
  score: number
  type: 'page' | 'video'
}

export async function searchKnowledgeBase(
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const lowerQuery = query.toLowerCase()

  const pages = await db.pages.toArray()

  const results: SearchResult[] = pages
    .map((page) => {
      const titleMatch = page.title.toLowerCase().includes(lowerQuery)
      const contentMatch = page.content.toLowerCase().includes(lowerQuery)
      const summaryMatch = page.summary?.toLowerCase().includes(lowerQuery)

      let score = 0
      if (titleMatch) score += 3
      if (contentMatch) score += 1
      if (summaryMatch) score += 2

      return {
        id: page.id!,
        title: page.title,
        content: page.content.substring(0, 500),
        url: page.url,
        score,
        type: 'page' as const,
      }
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return results
}

export async function getRelatedContent(
  contentId: number,
  type: 'page' | 'video',
  limit = 5
): Promise<SearchResult[]> {
  return []
}
