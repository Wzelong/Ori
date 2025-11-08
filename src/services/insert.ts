import { db } from '../db/database';
import { storeVector, loadVector } from '../llm/embeddings';
import { computeSimilarityFromOffscreen } from '../llm/offscreenClient';
import type { PageResult, Topic, Item, TopicEdge } from '../types/schema';
import { Tensor } from '@huggingface/transformers';
import { recomputeAllTopicPositions } from './positions';
import { getSettings } from './settings';

type EdgeData = Omit<TopicEdge, 'id' | 'createdAt'>;
type Neighbor = { topic: Topic; similarity: number };

type GraphContext = {
  existingTopics: Topic[];
  createdTopics: Array<{ topic: Topic; row: number }>;
  allEdges: EdgeData[];
  matrix: number[][];
  colMap: Map<string, number>;
};


function findBestMatch(similarities: number[]): { index: number; similarity: number } {
  let bestIdx = -1, bestSim = 0;
  for (let i = 0; i < similarities.length; i++) {
    if (similarities[i] > bestSim) {
      bestSim = similarities[i];
      bestIdx = i;
    }
  }
  return { index: bestIdx, similarity: bestSim };
}


function resolveTopics(
  topics: string[],
  existingTopics: Topic[],
  similarityMatrix: number[][],
  mergeThreshold: number
): { resolved: Topic[]; newIndices: Map<string, number> } {
  const resolved: Topic[] = [];
  const newIndices = new Map<string, number>();

  topics.forEach((label, i) => {
    const exactMatch = existingTopics.find(t => t.label === label);
    if (exactMatch) {
      resolved.push({ ...exactMatch, uses: exactMatch.uses + 1 });
      return;
    }

    const newTopicSimilarities = similarityMatrix[i].slice(0, i);
    const bestNewMatch = findBestMatch(newTopicSimilarities);

    if (bestNewMatch.index >= 0 && bestNewMatch.similarity > mergeThreshold) {
      const existingResolved = resolved[bestNewMatch.index];
      resolved.push({ ...existingResolved, uses: existingResolved.uses + 1 });
      return;
    }

    if (existingTopics.length === 0) {
      const newTopic: Topic = { id: crypto.randomUUID(), label, uses: 1, createdAt: Date.now() };
      resolved.push(newTopic);
      newIndices.set(newTopic.id, i);
      return;
    }

    const similarities = similarityMatrix[i].slice(topics.length);
    const best = findBestMatch(similarities);


    if (best.index >= 0 && best.similarity > mergeThreshold) {
      const match = existingTopics[best.index];
      resolved.push({ ...match, uses: match.uses + 1 });
    } else {
      const newTopic: Topic = { id: crypto.randomUUID(), label, uses: 1, createdAt: Date.now() };
      resolved.push(newTopic);
      newIndices.set(newTopic.id, i);
    }
  });

  return { resolved, newIndices };
}

async function linkItemTopics(itemId: string, topicIds: string[]) {
  for (const topicId of topicIds) {
    const existing = await db.item_topic.get([itemId, topicId]);
    if (!existing) {
      await db.item_topic.add({ itemId, topicId });
    }
  }
}


function getNeighbors(matrixRow: number, ctx: GraphContext): Neighbor[] {
  const neighbors: Neighbor[] = [];

  ctx.createdTopics.forEach(({ topic, row }) => {
    if (row < matrixRow) {
      neighbors.push({ topic, similarity: ctx.matrix[matrixRow][row] });
    }
  });

  ctx.existingTopics.forEach(topic => {
    const col = ctx.colMap.get(topic.id)!;
    neighbors.push({ topic, similarity: ctx.matrix[matrixRow][col] });
  });

  return neighbors.sort((a, b) => b.similarity - a.similarity);
}

function computeEdges(
  newTopic: Topic,
  matrixRow: number,
  ctx: GraphContext,
  edgeMinSimilarity: number,
  maxEdgesPerNode: number
): EdgeData[] {
  const neighbors = getNeighbors(matrixRow, ctx);
  const candidates = neighbors.filter(n => n.similarity >= edgeMinSimilarity);

  const connectedNodes = new Set<string>();
  ctx.allEdges.forEach(edge => {
    if (edge.src === newTopic.id) connectedNodes.add(edge.dst);
    if (edge.dst === newTopic.id) connectedNodes.add(edge.src);
  });

  const neighborEdgeCounts = new Map<string, number>();
  ctx.allEdges.forEach(edge => {
    neighborEdgeCounts.set(edge.src, (neighborEdgeCounts.get(edge.src) || 0) + 1);
    neighborEdgeCounts.set(edge.dst, (neighborEdgeCounts.get(edge.dst) || 0) + 1);
  });

  const edges: EdgeData[] = [];
  let edgeCount = 0;

  for (const neighbor of candidates) {
    if (edgeCount >= maxEdgesPerNode) break;
    if (connectedNodes.has(neighbor.topic.id)) continue;

    const neighborCurrentEdges = neighborEdgeCounts.get(neighbor.topic.id) || 0;
    if (neighborCurrentEdges >= maxEdgesPerNode) continue;

    const [src, dst] = [newTopic.id, neighbor.topic.id].sort();
    edges.push({ src, dst, similarity: neighbor.similarity });
    connectedNodes.add(neighbor.topic.id);
    neighborEdgeCounts.set(neighbor.topic.id, neighborCurrentEdges + 1);
    edgeCount++;
  }

  return edges;
}

export async function insertPageResult(pageResult: PageResult): Promise<Item | null> {
  try {
    if (await db.items.where('link').equals(pageResult.link).first()) {
      return null;
    }

    const settings = await getSettings();

    const newEmbeddings = pageResult.topicEmbeddings || [];
    const existingTopics = await db.topics.toArray();
    const existingEmbeddings = (await Promise.all(
      existingTopics.map(t => loadVector(db, 'topic', t.id))
    )) as number[][];

    const matrix = await computeSimilarityFromOffscreen(
      new Tensor('float32', [...newEmbeddings, ...existingEmbeddings].flat(), [
        newEmbeddings.length + existingEmbeddings.length,
        newEmbeddings[0]?.length || 0
      ])
    );

    const { resolved, newIndices } = resolveTopics(
      pageResult.topics,
      existingTopics,
      matrix,
      settings.graph.topicMergeThreshold
    );

    const ctx: GraphContext = {
      existingTopics,
      createdTopics: [],
      allEdges: (await db.topic_edges.toArray()).map(e => ({
        src: e.src,
        dst: e.dst,
        similarity: e.similarity
      })),
      matrix,
      colMap: new Map(existingTopics.map((t, i) => [t.id, newEmbeddings.length + i]))
    };

    const newTopics = resolved.filter(t => t.uses === 1);

    for (const topic of newTopics) {
      const row = newIndices.get(topic.id);
      if (row !== undefined) {
        const edges = computeEdges(
          topic,
          row,
          ctx,
          settings.graph.edgeMinSimilarity,
          settings.graph.maxEdgesPerNode
        );
        ctx.allEdges.push(...edges);
        ctx.createdTopics.push({ topic, row });
      }
    }

    const newEdges = ctx.allEdges.slice((await db.topic_edges.count()));

    return await db.transaction('rw', [db.items, db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
      const item: Item = {
        id: crypto.randomUUID(),
        title: pageResult.title,
        summary: pageResult.summary,
        link: pageResult.link,
        createdAt: Date.now()
      };
      await db.items.add(item);

      if (pageResult.contentEmbedding) {
        await storeVector(db, 'item', item.id, pageResult.contentEmbedding);
      }

      for (const topic of resolved) {
        const existing = await db.topics.get(topic.id);
        if (existing) {
          await db.topics.update(topic.id, { uses: existing.uses + 1 });
        } else {
          await db.topics.add(topic);
          const row = newIndices.get(topic.id);
          if (row !== undefined) {
            await storeVector(db, 'topic', topic.id, newEmbeddings[row]);
          }
        }
      }

      await linkItemTopics(item.id, resolved.map(t => t.id));

      for (const edge of newEdges) {
        const exists = await db.topic_edges.where('[src+dst]').equals([edge.src, edge.dst]).first();
        if (!exists) {
          await db.topic_edges.add({ ...edge, id: crypto.randomUUID(), createdAt: Date.now() });
        }
      }


      if (newTopics.length > 0) {
        setTimeout(() => {
          recomputeAllTopicPositions().catch(err =>
            console.error('[insert] Position recomputation failed:', err)
          );
        }, 0);
      }

      const timestamp = Date.now();
      chrome.storage.local.set({ lastInsertionTime: timestamp });

      return item;
    });
  } catch (error) {
    console.error('[insert] Error:', error);
    throw error;
  }
}
