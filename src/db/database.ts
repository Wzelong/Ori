import Dexie, { type Table } from 'dexie';
import type { Graph, Topic, Item, ItemTopic, TopicEdge, VectorRow } from '../types/schema';

const ORION_GRAPH_ID = 'orion';

export class GraphDB extends Dexie {
  graphs!: Table<Graph, string>;
  topics!: Table<Topic, string>;
  items!: Table<Item, string>;
  item_topic!: Table<ItemTopic, [string, string, string]>;
  topic_edges!: Table<TopicEdge, string>;
  vectors!: Table<VectorRow, [string, string, string]>;

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

    this.version(3).stores({
      graphs: `
        id,
        name,
        createdAt,
        isDefault
      `,
      topics: `
        id,
        [graphId+id],
        graphId,
        label,
        uses,
        createdAt,
        x,
        y,
        z
      `,
      items: `
        id,
        [graphId+id],
        graphId,
        link,
        createdAt
      `,
      item_topic: `
        &[graphId+itemId+topicId],
        graphId,
        itemId,
        topicId
      `,
      topic_edges: `
        id,
        [graphId+id],
        graphId,
        src,
        dst,
        createdAt
      `,
      vectors: `
        &[graphId+ownerType+ownerId],
        graphId,
        ownerType,
        ownerId,
        createdAt
      `
    }).upgrade(async (trans) => {
      const graphs = trans.table<Graph>('graphs');
      const topics = trans.table<Topic>('topics');
      const items = trans.table<Item>('items');
      const itemTopics = trans.table<ItemTopic>('item_topic');
      const edges = trans.table<TopicEdge>('topic_edges');
      const vectors = trans.table<VectorRow>('vectors');

      const orionGraph: Graph = {
        id: ORION_GRAPH_ID,
        name: 'Orion',
        createdAt: Date.now(),
        isDefault: true
      };
      await graphs.add(orionGraph);

      await topics.toCollection().modify((topic: any) => {
        topic.graphId = ORION_GRAPH_ID;
      });

      await items.toCollection().modify((item: any) => {
        item.graphId = ORION_GRAPH_ID;
      });

      await itemTopics.toCollection().modify((it: any) => {
        it.graphId = ORION_GRAPH_ID;
      });

      await edges.toCollection().modify((edge: any) => {
        edge.graphId = ORION_GRAPH_ID;
      });

      await vectors.toCollection().modify((vector: any) => {
        vector.graphId = ORION_GRAPH_ID;
      });
    });
  }
}

export const db = new GraphDB();
export { ORION_GRAPH_ID };

export async function clearDatabase() {
  await db.transaction('rw', [db.graphs, db.items, db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    await db.items.clear();
    await db.topics.clear();
    await db.item_topic.clear();
    await db.topic_edges.clear();
    await db.vectors.clear();
    await db.graphs.clear();
  });
}
