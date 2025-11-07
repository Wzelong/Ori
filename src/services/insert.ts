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

/**
 * Finds the best match in a similarity array
 * @param similarities - Array of similarity scores
 * @returns Index and similarity of best match
 */
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

/**
 * Attempts to merge a topic with existing topics based on similarity
 * @param label - Topic label to resolve
 * @param index - Index in the similarity matrix
 * @param existingTopics - Already persisted topics
 * @param similarityMatrix - Matrix of topic similarities
 * @param mergeThreshold - Minimum similarity for merging
 * @param resolvedSoFar - Topics already resolved in this batch
 * @returns Matched topic (existing or new) and whether it's new
 */
function findSimilarTopic(
  graphId: string,
  label: string,
  index: number,
  existingTopics: Topic[],
  similarityMatrix: number[][],
  mergeThreshold: number,
  resolvedSoFar: Topic[]
): { topic: Topic; isNew: boolean } {
  // Check for exact label match first
  const exactMatch = existingTopics.find(t => t.label === label);
  if (exactMatch) {
    return { topic: { ...exactMatch, uses: exactMatch.uses + 1 }, isNew: false };
  }

  // Check similarity with topics resolved in this batch
  const newTopicSimilarities = similarityMatrix[index].slice(0, index);
  const bestNewMatch = findBestMatch(newTopicSimilarities);

  if (bestNewMatch.index >= 0 && bestNewMatch.similarity > mergeThreshold) {
    const existingResolved = resolvedSoFar[bestNewMatch.index];
    return { topic: { ...existingResolved, uses: existingResolved.uses + 1 }, isNew: false };
  }

  // If no existing topics, create new
  if (existingTopics.length === 0) {
    const newTopic: Topic = { id: crypto.randomUUID(), graphId, label, uses: 1, createdAt: Date.now() };
    return { topic: newTopic, isNew: true };
  }

  // Check similarity with existing persisted topics
  const existingSimilarities = similarityMatrix[index].slice(resolvedSoFar.length);
  const bestExisting = findBestMatch(existingSimilarities);

  if (bestExisting.index >= 0 && bestExisting.similarity > mergeThreshold) {
    const match = existingTopics[bestExisting.index];
    return { topic: { ...match, uses: match.uses + 1 }, isNew: false };
  }

  // No match found, create new topic
  const newTopic: Topic = { id: crypto.randomUUID(), graphId, label, uses: 1, createdAt: Date.now() };
  return { topic: newTopic, isNew: true };
}

/**
 * Resolves new topic labels by merging with similar existing topics or creating new ones
 * Uses semantic similarity to prevent duplicate topics
 * @param topics - Array of topic labels to resolve
 * @param existingTopics - Already persisted topics in database
 * @param similarityMatrix - Precomputed similarity matrix
 * @param mergeThreshold - Minimum similarity threshold for merging (typically 0.85)
 * @returns Resolved topics and mapping of new topic IDs to their matrix indices
 */
function resolveTopics(
  graphId: string,
  topics: string[],
  existingTopics: Topic[],
  similarityMatrix: number[][],
  mergeThreshold: number
): { resolved: Topic[]; newIndices: Map<string, number> } {
  const resolved: Topic[] = [];
  const newIndices = new Map<string, number>();

  topics.forEach((label, i) => {
    const { topic, isNew } = findSimilarTopic(
      graphId,
      label,
      i,
      existingTopics,
      similarityMatrix,
      mergeThreshold,
      resolved
    );

    resolved.push(topic);

    if (isNew) {
      newIndices.set(topic.id, i);
    }
  });

  return { resolved, newIndices };
}

/**
 * Links an item to its associated topics in the junction table
 * @param graphId - Graph ID
 * @param itemId - ID of the item
 * @param topicIds - Array of topic IDs to link
 */
async function linkItemTopics(graphId: string, itemId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    const existing = await db.item_topic.get([graphId, itemId, topicId]);
    if (!existing) {
      await db.item_topic.add({ graphId, itemId, topicId });
    }
  }
}

/**
 * Gets all potential neighbor topics for a new topic, sorted by similarity
 * @param matrixRow - Row index in similarity matrix for the new topic
 * @param ctx - Graph context with existing and newly created topics
 * @returns Array of neighbors with similarity scores, sorted descending
 */
function getNeighbors(matrixRow: number, ctx: GraphContext): Neighbor[] {
  const neighbors: Neighbor[] = [];

  // Add newly created topics from this batch
  ctx.createdTopics.forEach(({ topic, row }) => {
    if (row < matrixRow) {
      neighbors.push({ topic, similarity: ctx.matrix[matrixRow][row] });
    }
  });

  // Add existing topics from database
  ctx.existingTopics.forEach(topic => {
    const col = ctx.colMap.get(topic.id)!;
    neighbors.push({ topic, similarity: ctx.matrix[matrixRow][col] });
  });

  return neighbors.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Checks if a node has room for more edges (respects max edges constraint)
 * @param nodeId - ID of the node to check
 * @param edges - All edges in the graph
 * @param maxEdgesPerNode - Maximum allowed edges per node
 * @returns True if node can accept more edges
 */
function canAcceptMoreEdges(nodeId: string, edges: EdgeData[], maxEdgesPerNode: number): boolean {
  const edgeCount = edges.reduce((count, edge) =>
    count + (edge.src === nodeId || edge.dst === nodeId ? 1 : 0), 0
  );
  return edgeCount < maxEdgesPerNode;
}

/**
 * Computes edges for a newly created topic using MST-style incremental construction
 * Applies constraints: minimum similarity, max edges per node, no duplicate connections
 * @param newTopic - The newly created topic
 * @param matrixRow - Row index in similarity matrix
 * @param ctx - Graph context with all topics and existing edges
 * @param edgeMinSimilarity - Minimum similarity threshold for creating edges
 * @param maxEdgesPerNode - Maximum edges allowed per node
 * @returns Array of new edges to be added to the graph
 */
function computeEdges(
  graphId: string,
  newTopic: Topic,
  matrixRow: number,
  ctx: GraphContext,
  edgeMinSimilarity: number,
  maxEdgesPerNode: number
): EdgeData[] {
  const neighbors = getNeighbors(matrixRow, ctx);
  const candidates = neighbors.filter(n => n.similarity >= edgeMinSimilarity);

  // Track which nodes are already connected to the new topic
  const connectedNodes = new Set<string>();
  ctx.allEdges.forEach(edge => {
    if (edge.src === newTopic.id) connectedNodes.add(edge.dst);
    if (edge.dst === newTopic.id) connectedNodes.add(edge.src);
  });

  const edges: EdgeData[] = [];
  let edgeCount = 0;

  for (const neighbor of candidates) {
    // Stop if new topic has reached max edges
    if (edgeCount >= maxEdgesPerNode) break;

    // Skip if already connected
    if (connectedNodes.has(neighbor.topic.id)) continue;

    // Skip if neighbor has reached max edges
    if (!canAcceptMoreEdges(neighbor.topic.id, ctx.allEdges, maxEdgesPerNode)) continue;

    // Create edge (sorted IDs for consistency)
    const [src, dst] = [newTopic.id, neighbor.topic.id].sort();
    edges.push({ graphId, src, dst, similarity: neighbor.similarity });

    connectedNodes.add(neighbor.topic.id);
    edgeCount++;
  }

  return edges;
}

/**
 * Computes similarity matrix for topic embeddings
 * @param newEmbeddings - Embeddings for new topics
 * @param existingEmbeddings - Embeddings for existing topics
 * @returns Similarity matrix as 2D array
 */
async function computeSimilarityMatrix(
  newEmbeddings: number[][],
  existingEmbeddings: number[][]
): Promise<number[][]> {
  return await computeSimilarityFromOffscreen(
    new Tensor('float32', [...newEmbeddings, ...existingEmbeddings].flat(), [
      newEmbeddings.length + existingEmbeddings.length,
      newEmbeddings[0]?.length || 0
    ])
  );
}

/**
 * Persists topics, edges, and item to database within a transaction
 * @param graphId - Graph ID
 * @param pageResult - Extracted page data
 * @param resolved - Resolved topic list
 * @param newIndices - Mapping of new topic IDs to embedding indices
 * @param newEdges - Edges to add
 * @returns Created item
 */
async function persistToDatabase(
  graphId: string,
  pageResult: PageResult,
  resolved: Topic[],
  newIndices: Map<string, number>,
  newEdges: EdgeData[]
): Promise<Item> {
  return await db.transaction('rw', [db.items, db.topics, db.item_topic, db.topic_edges, db.vectors], async () => {
    // Create item
    const item: Item = {
      id: crypto.randomUUID(),
      graphId,
      title: pageResult.title,
      summary: pageResult.summary,
      link: pageResult.link,
      createdAt: Date.now()
    };
    await db.items.add(item);

    // Store item embedding
    if (pageResult.contentEmbedding) {
      await storeVector(db, graphId, 'item', item.id, pageResult.contentEmbedding);
    }

    // Update or create topics
    for (const topic of resolved) {
      const existing = await db.topics.get(topic.id);
      if (existing) {
        await db.topics.update(topic.id, { uses: existing.uses + 1 });
      } else {
        await db.topics.add(topic);
        const row = newIndices.get(topic.id);
        if (row !== undefined && pageResult.topicEmbeddings) {
          await storeVector(db, graphId, 'topic', topic.id, pageResult.topicEmbeddings[row]);
        }
      }
    }

    // Link item to topics
    await linkItemTopics(graphId, item.id, resolved.map(t => t.id));

    // Add edges
    for (const edge of newEdges) {
      const exists = await db.topic_edges.where('[graphId+src+dst]').equals([graphId, edge.src, edge.dst]).first();
      if (!exists) {
        await db.topic_edges.add({ ...edge, id: crypto.randomUUID(), createdAt: Date.now() });
      }
    }

    return item;
  });
}

/**
 * Inserts a page result into the knowledge graph
 * Handles topic resolution, edge computation, and incremental graph construction
 * @param graphId - Graph ID to insert into
 * @param pageResult - Extracted page data with topics, embeddings, and content
 * @returns Created item or null if duplicate
 * @throws Error if insertion fails
 */
export async function insertPageResult(graphId: string, pageResult: PageResult): Promise<Item | null> {
  try {
    // Check for duplicate within this graph
    if (await db.items.where({ graphId, link: pageResult.link }).first()) {
      return null;
    }

    const settings = await getSettings(graphId);
    const newEmbeddings = pageResult.topicEmbeddings || [];
    const existingTopics = await db.topics.where('graphId').equals(graphId).toArray();

    // Load existing embeddings
    const existingEmbeddings = (await Promise.all(
      existingTopics.map(t => loadVector(db, graphId, 'topic', t.id))
    )) as number[][];

    // Compute similarity matrix for topic matching
    const matrix = await computeSimilarityMatrix(newEmbeddings, existingEmbeddings);

    // Resolve topics (merge with existing or create new)
    const { resolved, newIndices } = resolveTopics(
      graphId,
      pageResult.topics,
      existingTopics,
      matrix,
      settings.graph.topicMergeThreshold
    );

    // Initialize graph context for edge computation
    const ctx: GraphContext = {
      existingTopics,
      createdTopics: [],
      allEdges: (await db.topic_edges.where('graphId').equals(graphId).toArray()).map(e => ({
        graphId: e.graphId,
        src: e.src,
        dst: e.dst,
        similarity: e.similarity
      })),
      matrix,
      colMap: new Map(existingTopics.map((t, i) => [t.id, newEmbeddings.length + i]))
    };

    // Compute edges for new topics only
    const newTopics = resolved.filter(t => t.uses === 1);

    for (const topic of newTopics) {
      const row = newIndices.get(topic.id);
      if (row !== undefined) {
        const edges = computeEdges(
          graphId,
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

    const newEdges = ctx.allEdges.slice((await db.topic_edges.where('graphId').equals(graphId).count()));

    // Persist everything to database
    const item = await persistToDatabase(graphId, pageResult, resolved, newIndices, newEdges);

    // Trigger async position recomputation if new topics were added
    if (newTopics.length > 0) {
      setTimeout(() => {
        recomputeAllTopicPositions(graphId).catch(err =>
          console.error('[insert] Position recomputation failed:', err)
        );
      }, 0);
    }

    // Update last insertion timestamp
    const timestamp = Date.now();
    chrome.storage.local.set({ lastInsertionTime: timestamp });

    return item;
  } catch (error) {
    console.error('[insert] Error:', error);
    throw error;
  }
}
