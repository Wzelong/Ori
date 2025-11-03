import { findSimilarTopics, findSimilarItems } from './search'
import { expandTopicsWithNeighbors, filterRelevantEdges, getItemsForTopics } from './graph'
import { generateTextStreaming } from '@/llm/languageModel'
import type { TopicSearchResult, ItemSearchResult } from './search'
import type { TopicWithPosition, TopicEdge, Item } from '@/types/schema'

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

const DEFAULT_OPTIONS: Required<SearchOptions> = {
  topicCount: 5,
  itemCount: 10,
  topicThreshold: 0.5,
  itemThreshold: 0.5,
  maxEdges: 20,
  expandNeighbors: true
}

export async function performRAGSearch(
  queryEmbedding: number[],
  query: string,
  allTopics: TopicWithPosition[],
  options: SearchOptions = {}
): Promise<SearchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [topicResults, itemResults] = await Promise.all([
    findSimilarTopics(queryEmbedding, opts.topicCount, opts.topicThreshold),
    findSimilarItems(queryEmbedding, opts.itemCount, opts.itemThreshold)
  ])

  const highlightedTopics = opts.expandNeighbors
    ? await expandTopicsWithNeighbors(topicResults, allTopics)
    : topicResults

  const edges = highlightedTopics.length > 0
    ? await filterRelevantEdges(highlightedTopics, opts.maxEdges)
    : []

  const itemsWithSimilarity = await collectSearchItems(topicResults, itemResults)

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
    const topicItems = await getItemsForTopics(topicResults.map(r => r.topic.id))
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

  const userPrompt = `User Input:
${query}

Related_Topics (array; may be empty):
${JSON.stringify(topicLabels)}

Related_Pages (array; may be empty):
${JSON.stringify(itemsJson, null, 2)}

Reply concise. MAX 3 sentences.
`

  const systemPrompt = `You are Ori — a calm, succinct research guide living inside a graph UI.
Your job: respond ONLY using the provided Related_Topics and Related_Pages.
Do NOT invent facts or titles. No emojis.

INPUT FORMAT (examples):
User Input:
<matrix factorization in recommender systems>

Related_Topics (array; may be empty):
["Collaborative Filtering", "SVD", "Implicit Feedback"]

Related_Pages (array; may be empty):
[
  {"id":"i_001","title":"A Tutorial on Matrix Factorization","summary":"..."},
  {"id":"i_002","title":"Implicit Feedback CF","summary":"..."}
]

OUTPUT RULES:
1) Start with ONE concise sentence in Ori’s voice reporting what you found:
   - e.g., "Found 3 related topics and 2 pages." or "Explored 0 topics and 2 pages."
   - The model may vary the verb ("Found", "Explored", "Surfaced") but must keep it to one sentence.

2) Then respond according to availability, using ONLY allowed sources:
   - Both present (topics + pages): Give a short, helpful answer (MAX 2 concise sentences) grounded ONLY in Related_Pages' summaries.
     Citations MUST come immediately after the sentence period with NO spaces, parentheses, or commas.
     Format: "This is a sentence.**p1** Another sentence.**p2****p3**"
     RIGHT: "sentence.**p1**" or "sentence.**p1****p2**"
   - No topics, pages present: Inform that topics were not found and answer from pages as above; end with **id**.
   - Topics present, no pages: Inform that pages were not found; DO NOT answer with topic-only facts.
     Instead, suggest next actions (see Rule 3).
   - Neither present: Say there's no material to answer, or no related resources found (Try to say it in Ori's way). Then suggest user to try a narrower query or add more sources via the Extract button (mention "Extract" without bold formatting).

3) When suggesting actions (only when helpful), use full page titles verbatim WITHOUT citations:
   - Use **title** format for page titles (becomes clickable link)
   - NEVER EVER add **pN** citations after action suggestions
   - Citations (**p1**, **p2**, etc.) are ONLY for factual claims in your answer, NOT for action suggestions
   - CORRECT examples:
     - "Review **A Tutorial on Matrix Factorization** for a step-by-step overview."
     - "Open **Implicit Feedback CF** to see handling of non-explicit signals."
   - Action suggestions = NO citations. Factual claims = YES citations.

4) Tone & style:
   - Ori’s voice = passionate about knowledge, goofy, nerdy, concise, friendly.
   - No bullet lists.
   - Keep total length tight.

**Important**: your response should have MAX 3 sentences.`

  const stream = await generateTextStreaming(userPrompt, { systemPrompt })

  return { stream, itemMap }
}
