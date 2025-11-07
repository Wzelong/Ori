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

/**
 * Retrieves complete graph data including topics, items, and their relationships
 * @param graphId - Graph ID to retrieve data for
 * @returns Complete graph data structure with all entities and relationships
 */
export async function getGraphData(graphId: string): Promise<GraphData> {
  const topics = await db.topics.where('graphId').equals(graphId).toArray();
  const items = await db.items.where('graphId').equals(graphId).toArray();
  const itemTopics = await db.item_topic.where('graphId').equals(graphId).toArray();
  const edges = await db.topic_edges.where('graphId').equals(graphId).toArray();

  // Build map of items grouped by topic
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

/**
 * Gets all items associated with a specific topic
 * @param graphId - Graph ID
 * @param topicId - ID of the topic
 * @returns Array of items sorted by creation date (newest first)
 */
export async function getItemsForTopic(graphId: string, topicId: string): Promise<Item[]> {
  const itemTopicLinks = await db.item_topic
    .where({ graphId, topicId })
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

/**
 * Gets all items associated with multiple topics (union, not intersection)
 * @param graphId - Graph ID
 * @param topicIds - Array of topic IDs
 * @returns Array of unique items across all topics
 */
export async function getItemsForTopics(graphId: string, topicIds: string[]): Promise<Item[]> {
  if (topicIds.length === 0) return [];

  const itemTopicLinks = await db.item_topic
    .where('graphId')
    .equals(graphId)
    .and(link => topicIds.includes(link.topicId))
    .toArray();

  // Deduplicate item IDs
  const itemIds = [...new Set(itemTopicLinks.map(link => link.itemId))];

  if (itemIds.length === 0) return [];

  return await db.items
    .where('id')
    .anyOf(itemIds)
    .toArray();
}

/**
 * Expands search results to include direct neighbors of the highest-scoring topic
 * Used for context expansion in search results visualization
 * @param graphId - Graph ID
 * @param highlightedTopics - Topics from search results, sorted by similarity
 * @param allTopics - All topics with positions for visualization
 * @returns Expanded list including original topics and their neighbors
 */
export async function expandTopicsWithNeighbors(
  graphId: string,
  highlightedTopics: TopicSearchResult[],
  allTopics: TopicWithPosition[]
): Promise<TopicSearchResult[]> {
  if (highlightedTopics.length === 0) return [];

  // Use highest-scoring topic as anchor point
  const highestNode = highlightedTopics[0];
  const allEdges = await db.topic_edges.where('graphId').equals(graphId).toArray();

  // Find all edges connected to highest-scoring topic
  const directEdges = allEdges.filter(
    edge => edge.src === highestNode.topic.id || edge.dst === highestNode.topic.id
  );

  // Extract neighbor IDs
  const neighborIds = directEdges.map(edge =>
    edge.src === highestNode.topic.id ? edge.dst : edge.src
  );

  const highlightedIds = new Set(highlightedTopics.map(r => r.topic.id));
  const neighborsToAdd: TopicSearchResult[] = [];

  // Add neighbors that aren't already highlighted
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

/**
 * Filters edges to only those connecting highlighted topics
 * Limits results to top edges by similarity for performance
 * @param graphId - Graph ID
 * @param highlightedTopics - Topics to include in the subgraph
 * @param maxEdges - Maximum number of edges to return
 * @returns Filtered and sorted edges, highest similarity first
 */
export async function filterRelevantEdges(
  graphId: string,
  highlightedTopics: TopicSearchResult[],
  maxEdges: number = 20
): Promise<TopicEdge[]> {
  const topicIds = new Set(highlightedTopics.map(r => r.topic.id));
  const allEdges = await db.topic_edges.where('graphId').equals(graphId).toArray();

  return allEdges
    .filter(edge => topicIds.has(edge.src) && topicIds.has(edge.dst))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxEdges);
}
