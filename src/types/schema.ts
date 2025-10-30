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
  addedAt: number;
}

export interface ItemTopic {
  itemId: string;
  topicId: string;
}

export interface TopicEdge {
  id: string;
  src: string;       // Topic.id
  dst: string;       // Topic.id
  type: EdgeType;
  weight?: number;   // co-occurrence count (for related_to)
  createdAt: number;
}

export interface VectorRow {
  ownerType: 'item' | 'chunk' | 'topic';
  ownerId: string;
  buf: ArrayBuffer;
  createdAt: number;
}