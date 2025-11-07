import { db } from '../db/database';
import { loadVector } from '../llm/embeddings';
import type { Item, TopicWithPosition } from '../types/schema';
import { cosineSimilarity } from './vectorUtils';
import { getSettings } from './settings';

export interface TopicSearchResult {
  topic: TopicWithPosition;
  similarity: number;
}

export interface ItemSearchResult {
  item: Item;
  similarity: number;
}

/**
 * Finds topics similar to a query embedding using vector similarity search
 * @param graphId - Graph ID to search within
 * @param queryEmbedding - Query vector (typically from user search input)
 * @param topK - Maximum number of results to return (defaults to settings value)
 * @param threshold - Minimum similarity threshold (defaults to settings value)
 * @returns Array of topics sorted by similarity (highest first), limited to topK
 */
export async function findSimilarTopics(
  graphId: string,
  queryEmbedding: number[],
  topK?: number,
  threshold?: number
): Promise<TopicSearchResult[]> {
  const settings = await getSettings(graphId);
  const actualTopK = topK ?? settings.search.topicResultCount;
  const actualThreshold = threshold ?? settings.search.similarityThreshold;

  const topics = await db.topics.where('graphId').equals(graphId).toArray();

  const results: TopicSearchResult[] = [];

  for (const topic of topics) {
    // Skip topics without positions (not yet processed by dimensionality reduction)
    if (topic.x === undefined || topic.y === undefined || topic.z === undefined) {
      continue;
    }

    const embedding = await loadVector(db, graphId, 'topic', topic.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= actualThreshold) {
      results.push({
        topic: topic as TopicWithPosition,
        similarity
      });
    }
  }

  // Sort by similarity descending and limit to topK
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, actualTopK);
}

/**
 * Finds items similar to a query embedding using vector similarity search
 * @param graphId - Graph ID to search within
 * @param queryEmbedding - Query vector (typically from user search input)
 * @param topK - Maximum number of results to return (defaults to settings value)
 * @param threshold - Minimum similarity threshold (defaults to settings value)
 * @returns Array of items sorted by similarity (highest first), limited to topK
 */
export async function findSimilarItems(
  graphId: string,
  queryEmbedding: number[],
  topK?: number,
  threshold?: number
): Promise<ItemSearchResult[]> {
  const settings = await getSettings(graphId);
  const actualTopK = topK ?? settings.search.itemResultCount;
  const actualThreshold = threshold ?? settings.search.similarityThreshold;

  const items = await db.items.where('graphId').equals(graphId).toArray();

  const results: ItemSearchResult[] = [];

  for (const item of items) {
    const embedding = await loadVector(db, graphId, 'item', item.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= actualThreshold) {
      results.push({
        item,
        similarity
      });
    }
  }

  // Sort by similarity descending and limit to topK
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, actualTopK);
}
