import { db } from '../db/database';
import { loadVector } from '../llm/embeddings';
import { computeTopicPositions } from './dimensionality';
import type { Topic } from '../types/schema';

export async function recomputeAllTopicPositions(graphId: string): Promise<void> {

  const topics = await db.topics.where('graphId').equals(graphId).toArray();

  if (topics.length === 0) {
    return;
  }

  const embeddings = await Promise.all(
    topics.map(t => loadVector(db, graphId, 'topic', t.id))
  );

  const validEmbeddings: number[][] = [];
  const validTopics: Topic[] = [];

  for (let i = 0; i < topics.length; i++) {
    if (embeddings[i]) {
      validEmbeddings.push(embeddings[i]!);
      validTopics.push(topics[i]);
    }
  }


  const positions = await computeTopicPositions(graphId, validEmbeddings);

  await db.transaction('rw', db.topics, async () => {
    for (let i = 0; i < validTopics.length; i++) {
      const topic = validTopics[i];
      const [x, y, z] = positions[i];

      await db.topics.update(topic.id, { x, y, z });
    }
  });

}

export async function shouldRecomputePositions(graphId: string): Promise<boolean> {
  const topicsWithoutPositions = await db.topics
    .where('graphId')
    .equals(graphId)
    .filter(t => t.x === undefined || t.y === undefined || t.z === undefined)
    .count();

  return topicsWithoutPositions > 0;
}
