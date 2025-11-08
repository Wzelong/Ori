export interface PageResult {
  title: string;
  summary: string;
  topics: string[];
  link: string;
  topicEmbeddings?: number[][];
  contentEmbedding?: number[];
}

// Graph Database Types

export interface Topic {
  id: string;
  label: string;
  uses: number;      // denormalized count of linked items
  createdAt: number;
  x?: number;        // 3D position for visualization
  y?: number;
  z?: number;
}

export interface Item {
  id: string;
  title: string;
  summary: string;
  link: string;
  createdAt: number;
}

export interface ItemTopic {
  itemId: string;
  topicId: string;
}

export interface TopicEdge {
  id: string;
  src: string;
  dst: string;
  similarity: number;
  createdAt: number;
}

export interface VectorRow {
  ownerType: 'item' | 'topic';
  ownerId: string;
  buf: ArrayBuffer;
  createdAt: number;
}

// 3D Visualization Types

export interface TopicWithPosition extends Topic {
  x: number;
  y: number;
  z: number;
}

export interface SearchResult {
  topic: TopicWithPosition;
  similarity: number;
}

export interface StarMapData {
  allTopics: TopicWithPosition[];
  highlightedTopics?: SearchResult[];
  edges?: TopicEdge[];
}