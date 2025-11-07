import { findSimilarTopics, findSimilarItems } from './search'
import { expandTopicsWithNeighbors, filterRelevantEdges, getItemsForTopics } from './graph'
import { generateTextStreaming } from '@/llm/languageModel'
import { getSettings } from './settings'
import type { TopicSearchResult, ItemSearchResult } from './search'
import type { TopicWithPosition, TopicEdge, Item } from '@/types/schema'
import { RAG_SYSTEM_PROMPT, createRAGUserPrompt } from '@/config/prompts'

export interface SearchResult {
  highlightedTopics: TopicSearchResult[]
  edges: TopicEdge[]
  insightStream: ReadableStream<string>
  itemMap: Map<string, string>
}

export interface SearchOptions {
  topicCount?: number
  itemCount?: number
  topicThreshold?: number
  itemThreshold?: number
  maxEdges?: number
  expandNeighbors?: boolean
}

export async function performRAGSearch(
  graphId: string,
  queryEmbedding: number[],
  query: string,
  allTopics: TopicWithPosition[],
  options: SearchOptions = {}
): Promise<SearchResult> {
  const settings = await getSettings(graphId);

  const DEFAULT_OPTIONS: Required<SearchOptions> = {
    topicCount: settings.search.topicResultCount,
    itemCount: settings.search.itemResultCount,
    topicThreshold: settings.search.similarityThreshold,
    itemThreshold: settings.search.similarityThreshold,
    maxEdges: settings.search.maxEdgesInResults,
    expandNeighbors: true
  };

  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [topicResults, itemResults] = await Promise.all([
    findSimilarTopics(graphId, queryEmbedding, opts.topicCount, opts.topicThreshold),
    findSimilarItems(graphId, queryEmbedding, opts.itemCount, opts.itemThreshold)
  ])

  const highlightedTopics = opts.expandNeighbors
    ? await expandTopicsWithNeighbors(graphId, topicResults, allTopics)
    : topicResults

  const edges = highlightedTopics.length > 0
    ? await filterRelevantEdges(graphId, highlightedTopics, opts.maxEdges)
    : []

  const itemsWithSimilarity = await collectSearchItems(graphId, topicResults, itemResults)

  const { stream, itemMap } = await generateInsight(query, topicResults, itemsWithSimilarity)

  return {
    highlightedTopics,
    edges,
    insightStream: stream,
    itemMap
  }
}

interface ItemWithSimilarity {
  item: Item
  similarity: number | null
}

async function collectSearchItems(
  graphId: string,
  topicResults: TopicSearchResult[],
  itemResults: ItemSearchResult[]
): Promise<ItemWithSimilarity[]> {
  const itemMap = new Map<string, Item>()
  const similarities = new Map<string, number>()

  itemResults.forEach(({ item, similarity }) => {
    itemMap.set(item.id, item)
    similarities.set(item.id, similarity)
  })

  if (topicResults.length > 0) {
    const topicItems = await getItemsForTopics(graphId, topicResults.map(r => r.topic.id))
    topicItems.forEach(item => {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item)
      }
    })
  }

  return Array.from(itemMap.values()).map(item => ({
    item,
    similarity: similarities.get(item.id) ?? null
  }))
}

async function generateInsight(
  query: string,
  topicResults: TopicSearchResult[],
  itemsWithSimilarity: ItemWithSimilarity[]
): Promise<{ stream: ReadableStream<string>, itemMap: Map<string, string> }> {
  const itemMap = new Map<string, string>()

  const topicLabels = topicResults.map(r => r.topic.label)

  const itemsJson = itemsWithSimilarity.map(({ item }, index) => {
    const pageId = `p${index + 1}`
    itemMap.set(pageId, item.link)
    itemMap.set(item.title, item.link)
    return {
      id: pageId,
      title: item.title,
      summary: item.summary || ''
    }
  })

  const userPrompt = createRAGUserPrompt(query, topicLabels, itemsJson)
  const stream = await generateTextStreaming(userPrompt, { systemPrompt: RAG_SYSTEM_PROMPT })

  return { stream, itemMap }
}
