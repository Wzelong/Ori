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

export function calculateHierarchicalLayout(graphData: GraphData): GraphLayout {
  const { topics, edges } = graphData;

  if (topics.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  edges.forEach(edge => {
    if (edge.type === 'broader_than') {
      if (!childMap.has(edge.src)) childMap.set(edge.src, []);
      childMap.get(edge.src)!.push(edge.dst);

      if (!parentMap.has(edge.dst)) parentMap.set(edge.dst, []);
      parentMap.get(edge.dst)!.push(edge.src);
    }
  });

  const roots = topics.filter(t => !parentMap.has(t.id));

  if (roots.length === 0 && topics.length > 0) {
    roots.push(topics[0]);
  }

  const levels = new Map<string, number>();
  const visited = new Set<string>();

  const assignLevels = (topicId: string, level: number) => {
    if (visited.has(topicId)) return;
    visited.add(topicId);

    const currentLevel = levels.get(topicId) ?? Infinity;
    levels.set(topicId, Math.min(currentLevel, level));

    const children = childMap.get(topicId) || [];
    children.forEach(childId => {
      assignLevels(childId, level + 1);
    });
  };

  roots.forEach(root => assignLevels(root.id, 0));

  topics.forEach(topic => {
    if (!levels.has(topic.id)) {
      levels.set(topic.id, 0);
    }
  });

  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, topicId) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(topicId);
  });

  const nodeWidth = 180;
  const nodeHeight = 60;
  const horizontalGap = 40;
  const verticalGap = 100;

  const nodes: PositionedNode[] = [];
  const maxLevel = Math.max(...Array.from(levels.values()));

  for (let level = 0; level <= maxLevel; level++) {
    const nodesAtLevel = levelGroups.get(level) || [];
    const levelWidth = nodesAtLevel.length * nodeWidth + (nodesAtLevel.length - 1) * horizontalGap;
    const startX = -levelWidth / 2;

    nodesAtLevel.forEach((topicId, index) => {
      const topic = topics.find(t => t.id === topicId)!;
      const x = startX + index * (nodeWidth + horizontalGap) + nodeWidth / 2;
      const y = level * (nodeHeight + verticalGap) + nodeHeight / 2;

      nodes.push({
        topic,
        x,
        y,
        level
      });
    });
  }

  const maxWidth = Math.max(...nodes.map(n => Math.abs(n.x))) * 2 + nodeWidth;
  const height = (maxLevel + 1) * (nodeHeight + verticalGap);

  return {
    nodes,
    edges,
    width: Math.max(maxWidth, 800),
    height: Math.max(height, 400)
  };
}
