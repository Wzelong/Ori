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

export async function findSimilarTopics(
  queryEmbedding: number[],
  topK?: number,
  threshold?: number
): Promise<TopicSearchResult[]> {
  const settings = await getSettings();
  const actualTopK = topK ?? settings.search.topicResultCount;
  const actualThreshold = threshold ?? settings.search.similarityThreshold;

  const topics = await db.topics.toArray();

  const results: TopicSearchResult[] = [];

  for (const topic of topics) {
    if (topic.x === undefined || topic.y === undefined || topic.z === undefined) {
      continue;
    }

    const embedding = await loadVector(db, 'topic', topic.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= actualThreshold) {
      results.push({
        topic: topic as TopicWithPosition,
        similarity
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, actualTopK);
}

export async function findSimilarItems(
  queryEmbedding: number[],
  topK?: number,
  threshold?: number
): Promise<ItemSearchResult[]> {
  const settings = await getSettings();
  const actualTopK = topK ?? settings.search.itemResultCount;
  const actualThreshold = threshold ?? settings.search.similarityThreshold;

  const items = await db.items.toArray();

  const results: ItemSearchResult[] = [];

  for (const item of items) {
    const embedding = await loadVector(db, 'item', item.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity >= actualThreshold) {
      results.push({
        item,
        similarity
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, actualTopK);
}
