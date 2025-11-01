import { db } from '../db/database';
import { computeSimilarity, storeVector, loadVector } from '../llm/embeddings';
import type { PageResult, Topic, Item, TopicEdge } from '../types/schema';
import { Tensor } from '@huggingface/transformers';
import { recomputeAllTopicPositions } from './positions';

const TOPIC_MERGE_THRESHOLD = 0.92;
const EDGE_MIN_SIMILARITY = 0.86;
const MAX_EDGES_PER_NODE = 5;

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
  similarityMatrix: number[][]
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

    if (bestNewMatch.index >= 0 && bestNewMatch.similarity > TOPIC_MERGE_THRESHOLD) {
      const existingResolved = resolved[bestNewMatch.index];
      console.log(`[resolve] Merged new topics: "${label}" → "${existingResolved.label}" (${bestNewMatch.similarity.toFixed(3)})`);
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

    console.log(`[resolve] "${label}" best: ${best.similarity.toFixed(3)} (threshold: ${TOPIC_MERGE_THRESHOLD})`);

    if (best.index >= 0 && best.similarity > TOPIC_MERGE_THRESHOLD) {
      const match = existingTopics[best.index];
      console.log(`[resolve] Merged "${label}" → "${match.label}"`);
      resolved.push({ ...match, uses: match.uses + 1 });
    } else {
      console.log(`[resolve] Created: "${label}"`);
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

function computeEdges(newTopic: Topic, matrixRow: number, ctx: GraphContext): EdgeData[] {
  const neighbors = getNeighbors(matrixRow, ctx);
  const candidates = neighbors.filter(n => n.similarity >= EDGE_MIN_SIMILARITY);

  console.log('[edges]', newTopic.label, '- top neighbors:',
    candidates.slice(0, 5).map(n => `${n.topic.label}:${n.similarity.toFixed(3)}`).join(', '));

  const connectedNodes = new Set<string>();
  ctx.allEdges.forEach(edge => {
    if (edge.src === newTopic.id) connectedNodes.add(edge.dst);
    if (edge.dst === newTopic.id) connectedNodes.add(edge.src);
  });

  const edges: EdgeData[] = [];
  let edgeCount = 0;

  for (const neighbor of candidates) {
    if (edgeCount >= MAX_EDGES_PER_NODE) break;
    if (connectedNodes.has(neighbor.topic.id)) continue;

    const [src, dst] = [newTopic.id, neighbor.topic.id].sort();
    edges.push({ src, dst, similarity: neighbor.similarity });
    connectedNodes.add(neighbor.topic.id);
    edgeCount++;
  }

  return edges;
}

export async function insertPageResult(pageResult: PageResult): Promise<Item | null> {
  try {
    if (await db.items.where('link').equals(pageResult.link).first()) {
      console.log('[insert] Duplicate, skipping');
      return null;
    }

    const newEmbeddings = pageResult.topicEmbeddings || [];
    const existingTopics = await db.topics.toArray();
    const existingEmbeddings = (await Promise.all(
      existingTopics.map(t => loadVector(db, 'topic', t.id))
    )) as number[][];

    const matrix = await computeSimilarity(
      new Tensor('float32', [...newEmbeddings, ...existingEmbeddings].flat(), [
        newEmbeddings.length + existingEmbeddings.length,
        newEmbeddings[0]?.length || 0
      ])
    );
    console.log('[insert] Similarity matrix:', matrix.length, 'x', matrix[0]?.length);

    const { resolved, newIndices } = resolveTopics(pageResult.topics, existingTopics, matrix);
    console.log('[insert] Resolved:', resolved.length, 'new:', newIndices.size);

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
        console.log('[insert] Building edges:', topic.label);
        const edges = computeEdges(topic, row, ctx);
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
      console.log('[insert] Item:', item.id);

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

      console.log('[insert] Complete');

      if (newTopics.length > 0) {
        console.log('[insert] Recomputing topic positions...');
        await recomputeAllTopicPositions();
      }

      return item;
    });
  } catch (error) {
    console.error('[insert] Error:', error);
    throw error;
  }
}
