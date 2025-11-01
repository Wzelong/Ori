import { db } from '../db/database';
import { loadVector } from '../llm/embeddings';
import type { Topic, Item, TopicWithPosition, SearchResult } from '../types/schema';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export interface TopicSearchResult {
  topic: TopicWithPosition;
  similarity: number;
}

export interface ItemSearchResult {
  item: Item;
  similarity: number;
}

export async function findSimilarTopics(
  queryEmbedding: number[],
  topK: number = 5,
  threshold: number = 0.5
): Promise<TopicSearchResult[]> {
  const topics = await db.topics.toArray();

  const results: TopicSearchResult[] = [];

  for (const topic of topics) {
    if (topic.x === undefined || topic.y === undefined || topic.z === undefined) {
      continue;
    }

    const embedding = await loadVector(db, 'topic', topic.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= threshold) {
      results.push({
        topic: topic as TopicWithPosition,
        similarity
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, topK);
}

export async function findSimilarItems(
  queryEmbedding: number[],
  topK: number = 10,
  threshold: number = 0.5
): Promise<ItemSearchResult[]> {
  const items = await db.items.toArray();

  const results: ItemSearchResult[] = [];

  for (const item of items) {
    const embedding = await loadVector(db, 'item', item.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= threshold) {
      results.push({
        item,
        similarity
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, topK);
}

export interface CombinedSearchResult {
  topics: TopicSearchResult[];
  items: ItemSearchResult[];
}

export async function searchAll(
  queryEmbedding: number[],
  options: {
    topicK?: number;
    itemK?: number;
    topicThreshold?: number;
    itemThreshold?: number;
  } = {}
): Promise<CombinedSearchResult> {
  const {
    topicK = 5,
    itemK = 10,
    topicThreshold = 0.5,
    itemThreshold = 0.5
  } = options;

  const [topics, items] = await Promise.all([
    findSimilarTopics(queryEmbedding, topicK, topicThreshold),
    findSimilarItems(queryEmbedding, itemK, itemThreshold)
  ]);

  return { topics, items };
}
