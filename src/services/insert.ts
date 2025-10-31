import { db } from '../db/database';
import { generateText } from '../llm/languageModel';
import { computeSimilarity, storeVector, loadVector } from '../llm/embeddings';
import type { PageResult, Topic, Item, TopicEdge } from '../types/schema';
import { Tensor } from '@huggingface/transformers';

const TOPIC_MERGE_THRESHOLD = 0.92;
const CLASSIFICATION_MIN_SIMILARITY = 0.86;
const MAX_CLASSIFICATION_CANDIDATES = 8;
const MAX_SIBLING_EDGES = 3;

type EdgeData = Omit<TopicEdge, 'id' | 'createdAt'>;
type Neighbor = { topic: Topic; similarity: number };
type RelationshipType = 'PARENT' | 'CHILD' | 'SIBLING' | 'UNRELATED';
type Classification = { label: string; type: RelationshipType };

type GraphContext = {
  existingTopics: Topic[];
  createdTopics: Array<{ topic: Topic; row: number }>;
  allEdges: EdgeData[];
  matrix: number[][];
  colMap: Map<string, number>;
};

function hasPath(from: string, to: string, edges: EdgeData[]): boolean {
  const visited = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    edges.forEach(e => {
      if (e.src === current && e.type === 'broader_than') queue.push(e.dst);
    });
  }
  return false;
}

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

async function classifyRelationships(
  topicLabel: string,
  candidates: Array<{ label: string; similarity: number }>
): Promise<Classification[]> {
  if (candidates.length === 0) return [];

  const prompt = `Topic: "${topicLabel}"

Candidates:
${JSON.stringify(candidates, null, 2)}

Decision guide (apply in order):
1) Type-of test: does "Topic is a type of Candidate" read naturally?
   - If yes → PARENT (unless Candidate is a tool/dataset/property/metric/task).
2) Reverse type-of: does "Candidate is a type of Topic" read naturally?
   - If yes → CHILD (unless Candidate is a tool/dataset/property/metric/task).
3) Same specificity (close variants under a common supercategory) → SIBLING.
4) Else → UNRELATED.

Return JSON ONLY with one object per candidate, same order, using their ids.
`;

  const json = await generateText(prompt, {
    systemPrompt: `You classify relationships in a concept graph. For each candidate, return one of:
- PARENT  = candidate is STRICTLY BROADER than Topic (type-of):  "Topic is a type of Candidate" reads naturally; Topic's scope ⊂ Candidate's scope.
- CHILD   = candidate is STRICTLY NARROWER than Topic (type-of): "Candidate is a type of Topic".
- SIBLING = same specificity (share a broader parent) but neither is type-of the other.
- UNRELATED = different domain or only part/usage/tool/dataset/property/metric relation.

Never use part-of, made-of, used-by, dataset-of, metric-of, tool-of as PARENT/CHILD.
If the type-of test is not clearly true, prefer SIBLING or UNRELATED.
Return JSON ONLY matching the schema: [{"id":"...", "type":"PARENT|CHILD|SIBLING|UNRELATED"}] with EXACTLY one entry per candidate in the SAME ORDER.
No extra text.`,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          type: { type: 'string', enum: ['PARENT', 'CHILD', 'SIBLING', 'UNRELATED'] }
        },
        required: ['label', 'type']
      }
    }
  });

  console.log(`[classifyRelationships] Topic: "${topicLabel}"`);
  console.log(`[classifyRelationships] Candidates: [${candidates.map(c => c.label).join(', ')}]`);
  console.log(`[classifyRelationships] LLM Response: ${json}`);

  try {
    const parsed = JSON.parse(json);
    const result: Classification[] = Array.isArray(parsed) ? parsed : [];
    console.log(`[classifyRelationships] Classifications:`, result);
    return result;
  } catch (err) {
    console.log(`[classifyRelationships] Parse error:`, err);
    return [];
  }
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

async function computeEdges(newTopic: Topic, matrixRow: number, ctx: GraphContext): Promise<EdgeData[]> {
  const neighbors = getNeighbors(matrixRow, ctx);
  const top20 = neighbors.slice(0, 20);
  console.log('[edges] Top 20:', top20.slice(0, 5).map(n => `${n.topic.label}:${n.similarity.toFixed(3)}`).join(', '));

  const edges: EdgeData[] = [];

  const topCandidates = top20.filter(n => n.similarity >= CLASSIFICATION_MIN_SIMILARITY);

  const candidates = topCandidates
    .slice(0, MAX_CLASSIFICATION_CANDIDATES)
    .map(n => ({ label: n.topic.label, similarity: n.similarity }));

  if (candidates.length === 0) {
    return edges;
  }

  const classifications = await classifyRelationships(newTopic.label, candidates);

  const connectedNodes = new Set<string>();
  ctx.allEdges.forEach(edge => {
    if (edge.src === newTopic.id) connectedNodes.add(edge.dst);
    if (edge.dst === newTopic.id) connectedNodes.add(edge.src);
  });

  edges.forEach(edge => {
    if (edge.src === newTopic.id) connectedNodes.add(edge.dst);
    if (edge.dst === newTopic.id) connectedNodes.add(edge.src);
  });

  let parentCount = 0;
  let childCount = 0;
  let siblingCount = 0;

  for (const classification of classifications) {
    const neighbor = top20.find(n => n.topic.label === classification.label);
    if (!neighbor) continue;

    if (classification.type === 'PARENT') {
      if (parentCount >= 2) continue;
      if (hasPath(newTopic.id, neighbor.topic.id, ctx.allEdges)) continue;

      edges.push({
        src: neighbor.topic.id,
        dst: newTopic.id,
        type: 'broader_than',
        similarity: neighbor.similarity
      });
      connectedNodes.add(neighbor.topic.id);
      parentCount++;
    } else if (classification.type === 'CHILD') {
      if (childCount >= 2) continue;
      if (hasPath(neighbor.topic.id, newTopic.id, ctx.allEdges)) continue;

      edges.push({
        src: newTopic.id,
        dst: neighbor.topic.id,
        type: 'broader_than',
        similarity: neighbor.similarity
      });
      connectedNodes.add(neighbor.topic.id);
      childCount++;
    } else if (classification.type === 'SIBLING') {
      if (siblingCount >= MAX_SIBLING_EDGES) continue;
      if (connectedNodes.has(neighbor.topic.id)) continue;

      const [src, dst] = [newTopic.id, neighbor.topic.id].sort();
      edges.push({
        src,
        dst,
        type: 'related_to',
        similarity: neighbor.similarity
      });
      connectedNodes.add(neighbor.topic.id);
      siblingCount++;
    }
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
        type: e.type,
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
        const edges = await computeEdges(topic, row, ctx);
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
        const exists = await db.topic_edges.where('[src+dst+type]').equals([edge.src, edge.dst, edge.type]).first();
        if (!exists) {
          await db.topic_edges.add({ ...edge, id: crypto.randomUUID(), createdAt: Date.now() });
        }
      }

      console.log('[insert] Complete');
      return item;
    });
  } catch (error) {
    console.error('[insert] Error:', error);
    throw error;
  }
}
