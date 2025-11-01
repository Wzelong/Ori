import { db } from '../db/database';
import type { Topic, Item, TopicEdge } from '../types/schema';

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
