import { db } from './database';
import { recomputeAllTopicPositions } from '../services/positions';

export async function deleteTopic(topicId: string): Promise<void> {
  await db.transaction('rw', [db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    await db.topics.delete(topicId);
    await db.item_topic.where('topicId').equals(topicId).delete();
    await db.topic_edges.where('src').equals(topicId).delete();
    await db.topic_edges.where('dst').equals(topicId).delete();
    await db.vectors.delete(['topic', topicId]);
  });

  setTimeout(() => {
    recomputeAllTopicPositions().catch(err =>
      console.error('[deleteTopic] Position recomputation failed:', err)
    );
  }, 0);

  const timestamp = Date.now();
  chrome.storage.local.set({ lastInsertionTime: timestamp });
}

export async function deleteItem(itemId: string): Promise<void> {
  await db.transaction('rw', [db.items, db.item_topic, db.topics, db.vectors], async () => {
    const itemTopics = await db.item_topic.where('itemId').equals(itemId).toArray();
    const topicIds = itemTopics.map(it => it.topicId);

    await db.items.delete(itemId);
    await db.item_topic.where('itemId').equals(itemId).delete();
    await db.vectors.delete(['item', itemId]);

    for (const topicId of topicIds) {
      const topic = await db.topics.get(topicId);
      if (topic && topic.uses > 0) {
        await db.topics.update(topicId, { uses: topic.uses - 1 });
      }
    }
  });

  const timestamp = Date.now();
  chrome.storage.local.set({ lastInsertionTime: timestamp });
}

export async function deleteMultipleTopics(topicIds: string[]): Promise<void> {
  await db.transaction('rw', [db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    for (const topicId of topicIds) {
      await db.topics.delete(topicId);
      await db.item_topic.where('topicId').equals(topicId).delete();
      await db.topic_edges.where('src').equals(topicId).delete();
      await db.topic_edges.where('dst').equals(topicId).delete();
      await db.vectors.delete(['topic', topicId]);
    }
  });

  setTimeout(() => {
    recomputeAllTopicPositions().catch(err =>
      console.error('[deleteMultipleTopics] Position recomputation failed:', err)
    );
  }, 0);

  const timestamp = Date.now();
  chrome.storage.local.set({ lastInsertionTime: timestamp });
}

export async function deleteMultipleItems(itemIds: string[]): Promise<void> {
  await db.transaction('rw', [db.items, db.item_topic, db.topics, db.vectors], async () => {
    const topicUsesMap = new Map<string, number>();

    for (const itemId of itemIds) {
      const itemTopics = await db.item_topic.where('itemId').equals(itemId).toArray();

      for (const it of itemTopics) {
        topicUsesMap.set(it.topicId, (topicUsesMap.get(it.topicId) || 0) + 1);
      }

      await db.items.delete(itemId);
      await db.item_topic.where('itemId').equals(itemId).delete();
      await db.vectors.delete(['item', itemId]);
    }

    for (const [topicId, decrementBy] of topicUsesMap.entries()) {
      const topic = await db.topics.get(topicId);
      if (topic) {
        await db.topics.update(topicId, { uses: Math.max(0, topic.uses - decrementBy) });
      }
    }
  });

  const timestamp = Date.now();
  chrome.storage.local.set({ lastInsertionTime: timestamp });
}
