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
        createdAt
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

    this.version(2).stores({
      topics: `
        id,
        &label,
        uses,
        createdAt,
        x,
        y,
        z
      `
    });
  }
}

export const db = new GraphDB();

export async function clearDatabase() {
  await db.transaction('rw', [db.items, db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    await db.items.clear();
    await db.topics.clear();
    await db.item_topic.clear();
    await db.topic_edges.clear();
    await db.vectors.clear();
  });
  console.log('[db] Database cleared');
}
