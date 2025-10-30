export interface PageResult {
  title: string;
  summary: string;
  topics: string[];
  link: string;
  topicEmbeddings?: number[][];
  contentEmbedding?: number[];
}

// Graph Database Types

export type EdgeType = 'related_to' | 'broader_than';

export interface Topic {
  id: string;
  label: string;
  uses: number;      // denormalized count of linked items
  createdAt: number;
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
  type: EdgeType;
  similarity: number;
  createdAt: number;
}

export interface VectorRow {
  ownerType: 'item' | 'topic';
  ownerId: string;
  buf: ArrayBuffer;
  createdAt: number;
}