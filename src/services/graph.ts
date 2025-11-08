import { db } from '../db/database';
import type { Topic, Item, TopicEdge, TopicWithPosition } from '../types/schema';
import type { TopicSearchResult } from './search';

export interface GraphData {
  topics: Topic[];
  items: Item[];
  itemsByTopic: Map<string, Item[]>;
  edges: TopicEdge[];
}

export interface PositionedNode {
  topic: Topic;
  x: number;
  y: number;
  level: number;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  edges: TopicEdge[];
  width: number;
  height: number;
}

export async function getGraphData(): Promise<GraphData> {
  const topics = await db.topics.toArray();
  const items = await db.items.toArray();
  const itemTopics = await db.item_topic.toArray();
  const edges = await db.topic_edges.toArray();

  const itemsByTopic = new Map<string, Item[]>();

  for (const topic of topics) {
    const linkedItemIds = itemTopics
      .filter(it => it.topicId === topic.id)
      .map(it => it.itemId);

    const linkedItems = items.filter(item => linkedItemIds.includes(item.id));
    itemsByTopic.set(topic.id, linkedItems);
  }

  return {
    topics,
    items,
    itemsByTopic,
    edges
  };
}

export async function getItemsForTopic(topicId: string): Promise<Item[]> {
  const itemTopicLinks = await db.item_topic
    .where('topicId')
    .equals(topicId)
    .toArray();

  const itemIds = itemTopicLinks.map(link => link.itemId);

  if (itemIds.length === 0) {
    return [];
  }

  const items = await db.items
    .where('id')
    .anyOf(itemIds)
    .toArray();

  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getItemsForTopics(topicIds: string[]): Promise<Item[]> {
  if (topicIds.length === 0) return [];

  const itemTopicLinks = await db.item_topic
    .where('topicId')
    .anyOf(topicIds)
    .toArray();

  const itemIds = [...new Set(itemTopicLinks.map(link => link.itemId))];

  if (itemIds.length === 0) return [];

  return await db.items
    .where('id')
    .anyOf(itemIds)
    .toArray();
}

export async function expandTopicsWithNeighbors(
  highlightedTopics: TopicSearchResult[],
  allTopics: TopicWithPosition[]
): Promise<TopicSearchResult[]> {
  if (highlightedTopics.length === 0) return [];

  const highestNode = highlightedTopics[0];
  const allEdges = await db.topic_edges.toArray();

  const directEdges = allEdges.filter(
    edge => edge.src === highestNode.topic.id || edge.dst === highestNode.topic.id
  );

  const neighborIds = directEdges.map(edge =>
    edge.src === highestNode.topic.id ? edge.dst : edge.src
  );

  const highlightedIds = new Set(highlightedTopics.map(r => r.topic.id));
  const neighborsToAdd: TopicSearchResult[] = [];

  neighborIds.forEach(neighborId => {
    if (!highlightedIds.has(neighborId)) {
      const neighborTopic = allTopics.find(t => t.id === neighborId);
      if (neighborTopic) {
        neighborsToAdd.push({
          topic: neighborTopic,
          similarity: 0
        });
      }
    }
  });

  return [...highlightedTopics, ...neighborsToAdd];
}

export async function filterRelevantEdges(
  highlightedTopics: TopicSearchResult[],
  maxEdges: number = 20
): Promise<TopicEdge[]> {
  const topicIds = new Set(highlightedTopics.map(r => r.topic.id));
  const allEdges = await db.topic_edges.toArray();

  return allEdges
    .filter(edge => topicIds.has(edge.src) && topicIds.has(edge.dst))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxEdges);
}
