import { db } from './database';
import { recomputeAllTopicPositions } from '../services/positions';

/**
 * Updates the last insertion timestamp in Chrome storage
 */
function updateLastInsertionTime(): void {
  const timestamp = Date.now();
  chrome.storage.local.set({ lastInsertionTime: timestamp });
}

/**
 * Schedules position recomputation for topics asynchronously
 * @param graphId - Graph ID to recompute positions for
 * @param context - Context string for error logging
 */
function schedulePositionRecomputation(graphId: string, context: string): void {
  setTimeout(() => {
    recomputeAllTopicPositions(graphId).catch(err =>
      console.error(`[${context}] Position recomputation failed:`, err)
    );
  }, 0);
}

/**
 * Deletes a single topic and all its associated data within a transaction
 * @param graphId - Graph ID
 * @param topicId - ID of the topic to delete
 */
async function executeTopicDeletion(graphId: string, topicId: string): Promise<void> {
  await db.topics.delete(topicId);
  await db.item_topic.where({ graphId, topicId }).delete();
  await db.topic_edges.where({ graphId, src: topicId }).delete();
  await db.topic_edges.where({ graphId, dst: topicId }).delete();
  await db.vectors.delete([graphId, 'topic', topicId]);
}

/**
 * Deletes a single topic from the knowledge graph
 * Removes the topic, its edges, associated item relationships, and vectors
 * Triggers position recomputation after deletion
 * @param graphId - Graph ID
 * @param topicId - ID of the topic to delete
 */
export async function deleteTopic(graphId: string, topicId: string): Promise<void> {
  await db.transaction('rw', [db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    await executeTopicDeletion(graphId, topicId);
  });

  schedulePositionRecomputation(graphId, 'deleteTopic');
  updateLastInsertionTime();
}

/**
 * Deletes a single item from the knowledge graph
 * Removes the item, its topic associations, vectors, and decrements topic usage counts
 * @param graphId - Graph ID
 * @param itemId - ID of the item to delete
 */
export async function deleteItem(graphId: string, itemId: string): Promise<void> {
  await db.transaction('rw', [db.items, db.item_topic, db.topics, db.vectors], async () => {
    const itemTopics = await db.item_topic.where({ graphId, itemId }).toArray();
    const topicIds = itemTopics.map(it => it.topicId);

    await db.items.delete(itemId);
    await db.item_topic.where({ graphId, itemId }).delete();
    await db.vectors.delete([graphId, 'item', itemId]);

    for (const topicId of topicIds) {
      const topic = await db.topics.get(topicId);
      if (topic && topic.uses > 0) {
        await db.topics.update(topicId, { uses: topic.uses - 1 });
      }
    }
  });

  updateLastInsertionTime();
}

/**
 * Deletes multiple topics from the knowledge graph in batch
 * More efficient than calling deleteTopic() multiple times
 * @param graphId - Graph ID
 * @param topicIds - Array of topic IDs to delete
 */
export async function deleteMultipleTopics(graphId: string, topicIds: string[]): Promise<void> {
  await db.transaction('rw', [db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    for (const topicId of topicIds) {
      await executeTopicDeletion(graphId, topicId);
    }
  });

  schedulePositionRecomputation(graphId, 'deleteMultipleTopics');
  updateLastInsertionTime();
}

/**
 * Deletes multiple items from the knowledge graph in batch
 * Efficiently handles topic usage count updates for all affected topics
 * @param graphId - Graph ID
 * @param itemIds - Array of item IDs to delete
 */
export async function deleteMultipleItems(graphId: string, itemIds: string[]): Promise<void> {
  await db.transaction('rw', [db.items, db.item_topic, db.topics, db.vectors], async () => {
    const topicUsesMap = new Map<string, number>();

    for (const itemId of itemIds) {
      const itemTopics = await db.item_topic.where({ graphId, itemId }).toArray();

      for (const it of itemTopics) {
        topicUsesMap.set(it.topicId, (topicUsesMap.get(it.topicId) || 0) + 1);
      }

      await db.items.delete(itemId);
      await db.item_topic.where({ graphId, itemId }).delete();
      await db.vectors.delete([graphId, 'item', itemId]);
    }

    for (const [topicId, decrementBy] of topicUsesMap.entries()) {
      const topic = await db.topics.get(topicId);
      if (topic) {
        await db.topics.update(topicId, { uses: Math.max(0, topic.uses - decrementBy) });
      }
    }
  });

  updateLastInsertionTime();
}
