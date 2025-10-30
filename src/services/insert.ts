import { db } from '../db/database';
import { generateText } from '../llm/languageModel';
import { computeSimilarity, storeVector, loadVector } from '../llm/embeddings';
import type { PageResult, Topic, Item } from '../types/schema';
import { Tensor } from '@huggingface/transformers';

const TOPIC_MERGE_THRESHOLD = 0.92;    // high: only merge near-duplicates
const PARENT_MIN_SIMILARITY = 0.75;    // moderate: parent must be related
const RELATED_MIN_SIMILARITY = 0.70;   // lower: capture looser associations

// BFS to detect cycles in broader_than edges (prevents circular hierarchies)
async function hasPath(from: string, to: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const edges = await db.topic_edges
      .where('[src+dst+type]')
      .between([current, '', ''], [current, '\uffff', '\uffff'])
      .toArray();

    for (const edge of edges) {
      if (edge.type === 'broader_than') {
        queue.push(edge.dst);
      }
    }
  }
  return false;
}

// Insert item if new, returns null if already exists
async function resolveItem(title: string, summary: string, link: string): Promise<Item | null> {
  const existing = await db.items.where('link').equals(link).first();
  if (existing) return null;

  const id = crypto.randomUUID();
  const item: Item = {
    id,
    title,
    summary,
    link,
    createdAt: Date.now()
  };
  await db.items.add(item);
  return item;
}

// Resolve topics with semantic deduplication (>0.92 threshold)
async function resolveTopics(
  topics: string[],
  embeddings: number[][],
  existingTopics: Topic[],
  similarityMatrix: number[][]
): Promise<{ resolved: Topic[]; newTopicIndices: Map<string, number> }> {
  const resolved: Topic[] = [];
  const newTopicIndices = new Map<string, number>();

  for (let i = 0; i < topics.length; i++) {
    const label = topics[i];
    const embedding = embeddings[i];

    const exactMatch = await db.topics.where('label').equals(label).first();
    if (exactMatch) {
      await db.topics.update(exactMatch.id, { uses: exactMatch.uses + 1 });
      resolved.push({ ...exactMatch, uses: exactMatch.uses + 1 });
      continue;
    }

    if (existingTopics.length === 0) {
      const id = crypto.randomUUID();
      const newTopic: Topic = {
        id,
        label,
        uses: 1,
        createdAt: Date.now()
      };
      await db.topics.add(newTopic);
      await storeVector(db, 'topic', id, embedding);
      resolved.push(newTopic);
      continue;
    }

    const similarities = similarityMatrix[i].slice(topics.length);
    let bestSimilarity = 0;
    let bestMatchIndex = -1;

    for (let j = 0; j < similarities.length; j++) {
      if (similarities[j] > bestSimilarity) {
        bestSimilarity = similarities[j];
        bestMatchIndex = j;
      }
    }

    console.log(`[resolve] "${label}" best match: ${bestSimilarity.toFixed(3)} (threshold: ${TOPIC_MERGE_THRESHOLD})`);
    if (bestMatchIndex >= 0 && bestSimilarity > TOPIC_MERGE_THRESHOLD) {
      const bestMatch = existingTopics[bestMatchIndex];
      console.log(`[resolve] Merged "${label}" → "${bestMatch.label}"`);
      await db.topics.update(bestMatch.id, { uses: bestMatch.uses + 1 });
      resolved.push({ ...bestMatch, uses: bestMatch.uses + 1 });
    } else {
      console.log(`[resolve] Created new topic: "${label}"`);

      const id = crypto.randomUUID();
      const newTopic: Topic = {
        id,
        label,
        uses: 1,
        createdAt: Date.now()
      };
      await db.topics.add(newTopic);
      await storeVector(db, 'topic', id, embedding);
      resolved.push(newTopic);
      newTopicIndices.set(id, i);
    }
  }

  return { resolved, newTopicIndices };
}

async function linkItemTopics(itemId: string, topicIds: string[]) {
  for (const topicId of topicIds) {
    const existing = await db.item_topic.get([itemId, topicId]);
    if (!existing) {
      await db.item_topic.add({ itemId, topicId });
    }
  }
}

async function enforceRelatedCap(nodeId: string) {
  const allRelated = await db.topic_edges
    .where('type')
    .equals('related_to')
    .filter(e => e.src === nodeId || e.dst === nodeId)
    .toArray();

  if (allRelated.length > 40) {
    allRelated.sort((a, b) => a.similarity - b.similarity);
    for (let i = 0; i < allRelated.length - 40; i++) {
      await db.topic_edges.delete(allRelated[i].id);
    }
  }
}

// Build graph edges for newly created topic (parents + related + enforce caps)
async function buildEdges(
  newTopicId: string,
  newTopicMatrixRow: number,
  existingTopics: Topic[],
  existingIdToMatrixCol: Map<string, number>,
  similarityMatrix: number[][]
) {
  if (existingTopics.length === 0) return;

  const neighbors = existingTopics.map(topic => {
    const col = existingIdToMatrixCol.get(topic.id)!;
    return {
      topic,
      similarity: similarityMatrix[newTopicMatrixRow][col]
    };
  });

  neighbors.sort((a, b) => b.similarity - a.similarity);
  const top20 = neighbors.slice(0, 20);
  console.log('[edges] Top 5 neighbors:', top20.slice(0, 5).map(n => `${n.topic.label}:${n.similarity.toFixed(3)}`).join(', '));

  // LLM selects 0-2 parent topics from top-5 candidates (filtered by >0.75 similarity)
  const top5 = top20.slice(0, 5);
  const candidateLabels = top5.map(n => n.topic.label).join(', ');

  const parentSelectionPrompt = `Given a new topic "${(await db.topics.get(newTopicId))?.label}", select 0-2 parent topics that are broader concepts.

Candidates: ${candidateLabels}

Return JSON array of selected labels (0-2 items):
["label1", "label2"] or []`;

  const parentJson = await generateText(parentSelectionPrompt, {
    systemPrompt: 'You select parent topics that represent broader concepts. Return valid JSON array only.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 2
    }
  });

  let selectedParentLabels: string[] = [];
  try {
    const parsed = JSON.parse(parentJson);
    if (Array.isArray(parsed)) {
      selectedParentLabels = parsed.slice(0, 2).map(String);
    }
  } catch {
    selectedParentLabels = [];
  }

  const selectedParents = top5.filter(n =>
    selectedParentLabels.includes(n.topic.label) &&
    n.similarity >= PARENT_MIN_SIMILARITY
  );

  for (const parent of selectedParents) {
    const cycleExists = await hasPath(newTopicId, parent.topic.id);
    if (cycleExists) continue;

    const edgeId = crypto.randomUUID();
    const existing = await db.topic_edges
      .where('[src+dst+type]')
      .equals([parent.topic.id, newTopicId, 'broader_than'])
      .first();

    if (!existing) {
      await db.topic_edges.add({
        id: edgeId,
        src: parent.topic.id,
        dst: newTopicId,
        type: 'broader_than',
        similarity: parent.similarity,
        createdAt: Date.now()
      });
    }
  }

  // Cap: max 2 parents per node
  const currentParents = await db.topic_edges
    .where('[src+dst+type]')
    .between(['\0', newTopicId, 'broader_than'], ['\uffff', newTopicId, 'broader_than'])
    .toArray();

  if (currentParents.length > 2) {
    currentParents.sort((a, b) => a.similarity - b.similarity);
    for (let i = 0; i < currentParents.length - 2; i++) {
      await db.topic_edges.delete(currentParents[i].id);
    }
  }

  // Add up to 3 related_to edges (>0.70 similarity, undirected, canonical ordering)
  const existingRelated = await db.topic_edges
    .where('type')
    .equals('related_to')
    .filter(e => e.src === newTopicId || e.dst === newTopicId)
    .toArray();

  const existingRelatedIds = new Set(existingRelated.flatMap(e => [e.src, e.dst]));
  const availableRelated = top20.filter(n =>
    !existingRelatedIds.has(n.topic.id) &&
    n.similarity >= RELATED_MIN_SIMILARITY
  );

  for (let i = 0; i < Math.min(3, availableRelated.length); i++) {
    const neighbor = availableRelated[i];
    const [src, dst] = [newTopicId, neighbor.topic.id].sort();

    const existing = await db.topic_edges
      .where('[src+dst+type]')
      .equals([src, dst, 'related_to'])
      .first();

    if (!existing) {
      await db.topic_edges.add({
        id: crypto.randomUUID(),
        src,
        dst,
        type: 'related_to',
        similarity: neighbor.similarity,
        createdAt: Date.now()
      });
      await enforceRelatedCap(newTopicId);
      await enforceRelatedCap(neighbor.topic.id);
    }
  }

  // Cap: max 30 children per parent
  for (const parent of selectedParents) {
    const children = await db.topic_edges
      .where('[src+dst+type]')
      .between([parent.topic.id, '', 'broader_than'], [parent.topic.id, '\uffff', 'broader_than'])
      .toArray();

    if (children.length > 30) {
      children.sort((a, b) => a.similarity - b.similarity);
      for (let i = 0; i < children.length - 30; i++) {
        await db.topic_edges.delete(children[i].id);
      }
    }
  }
}

// Main entry: insert PageResult into database with graph construction
export async function insertPageResult(pageResult: PageResult): Promise<Item | null> {
  try {
    return await db.transaction('rw', [db.items, db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    const item = await resolveItem(pageResult.title, pageResult.summary, pageResult.link);
    if (!item) {
      console.log('[insert] Duplicate item, skipping');
      return null;
    }
    console.log('[insert] New item:', item.id);

    if (pageResult.contentEmbedding) {
      await storeVector(db, 'item', item.id, pageResult.contentEmbedding);
    }

    const newTopicEmbeddings = pageResult.topicEmbeddings || [];
    if (newTopicEmbeddings.length === 0) return item;

    // Load existing topics with their embeddings
    const existingTopics = await db.topics.toArray();
    const existingEmbeddings = (await Promise.all(
      existingTopics.map(t => loadVector(db, 'topic', t.id))
    )) as number[][];

    // Compute similarity matrix: [newTopics | existingTopics]
    const allEmbeddings = [...newTopicEmbeddings, ...existingEmbeddings];
    const tensor = new Tensor('float32', allEmbeddings.flat(), [allEmbeddings.length, newTopicEmbeddings[0].length]);
    const similarityMatrix = await computeSimilarity(tensor);
    console.log('[insert] Similarity matrix:', similarityMatrix.length, 'x', similarityMatrix[0]?.length);

    const { resolved: resolvedTopics, newTopicIndices } = await resolveTopics(
      pageResult.topics,
      newTopicEmbeddings,
      existingTopics,
      similarityMatrix
    );
    console.log('[insert] Resolved topics:', resolvedTopics.length, 'new:', newTopicIndices.size);

    await linkItemTopics(
      item.id,
      resolvedTopics.map(t => t.id)
    );

    const newTopics = resolvedTopics.filter(t => t.uses === 1);
    const existingIdToMatrixCol = new Map<string, number>();
    existingTopics.forEach((topic, idx) => {
      existingIdToMatrixCol.set(topic.id, newTopicEmbeddings.length + idx);
    });

    for (const topic of newTopics) {
      const matrixRow = newTopicIndices.get(topic.id);
      if (matrixRow !== undefined) {
        console.log('[insert] Building edges for:', topic.label);
        await buildEdges(topic.id, matrixRow, existingTopics, existingIdToMatrixCol, similarityMatrix);
      }
    }
    console.log('[insert] Complete');

      return item;
    });
  } catch (error) {
    console.error('[insert] Transaction error:', error);
    throw error;
  }
}
