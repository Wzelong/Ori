import Dexie, { type Table } from 'dexie';
import type { Topic, Item, ItemTopic, TopicEdge, VectorRow } from '../types/schema';

export class GraphDB extends Dexie {
  topics!: Table<Topic, string>;
  items!: Table<Item, string>;
  item_topic!: Table<ItemTopic, [string, string]>;
  topic_edges!: Table<TopicEdge, string>;
  vectors!: Table<VectorRow, [string, string]>;

  constructor() {
    super('graph-db');

    this.version(1).stores({
      topics: `
        id,
        &label,
        uses,
        createdAt
      `,
      items: `
        id,
        &link,
        addedAt
      `,
      item_topic: `
        &[itemId+topicId],
        itemId,
        topicId
      `,
      topic_edges: `
        id,
        &[src+dst+type],
        src,
        dst,
        type,
        createdAt
      `,
      vectors: `
        &[ownerType+ownerId],
        ownerType,
        ownerId,
        createdAt
      `
    });
  }
}

export const db = new GraphDB();
