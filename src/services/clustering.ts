import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { db } from '../db/database';
import type { TopicWithPosition, TopicEdge } from '../types/schema';
import { loadVector } from '../llm/embeddings';
import { findSemanticMedoid } from './vectorUtils';
import { getSettings } from './settings';

export interface ClusterInfo {
  id: number;
  centroidId: string;
  memberIds: string[];
  centroidPosition: [number, number, number];
}

export interface ClusterWithEdges extends ClusterInfo {
  color: string;
  edges: TopicEdge[];
  edgeDepths: Map<string, number>;
  edgeDirections: Map<string, { from: string; to: string }>;
}

export async function identifyClusters(
  graphId: string,
  topics: TopicWithPosition[],
  resolution?: number,
  minClusterSize?: number
): Promise<ClusterInfo[]> {
  if (topics.length < 2) return [];

  const settings = await getSettings(graphId);
  const actualResolution = resolution ?? settings.graph.clusterResolution;
  const actualMinClusterSize = minClusterSize ?? settings.graph.minClusterSize;

  const allEdges = await db.topic_edges.where('graphId').equals(graphId).toArray();
  const topicIds = new Set(topics.map(t => t.id));

  const graphEdges = allEdges
    .filter(e => topicIds.has(e.src) && topicIds.has(e.dst));

  const graph = new Graph();
  const sortedTopics = [...topics].sort((a, b) => a.id.localeCompare(b.id));
  sortedTopics.forEach(t => graph.addNode(t.id));

  const sortedEdges = [...graphEdges].sort((a, b) => {
    const cmp = a.src.localeCompare(b.src);
    return cmp !== 0 ? cmp : a.dst.localeCompare(b.dst);
  });

  sortedEdges.forEach(e => {
    if (!graph.hasEdge(e.src, e.dst)) {
      graph.addEdge(e.src, e.dst, { weight: e.similarity });
    }
  });

  const communities = louvain(graph, { resolution: actualResolution, randomWalk: false });

  const clusterMap = new Map<number, string[]>();
  const nodeToCluster = new Map<string, number>();

  Object.entries(communities).forEach(([nodeId, commId]) => {
    if (nodeToCluster.has(nodeId)) {
      console.warn(`Node ${nodeId} already assigned to cluster ${nodeToCluster.get(nodeId)}, trying to reassign to ${commId}`);
    }
    nodeToCluster.set(nodeId, commId);

    if (!clusterMap.has(commId)) clusterMap.set(commId, []);
    clusterMap.get(commId)!.push(nodeId);
  });

  const clusters: ClusterInfo[] = [];
  const clusterEntries = Array.from(clusterMap.entries()).filter(
    ([_, members]) => members.length >= actualMinClusterSize
  );

  for (const [clusterId, memberIds] of clusterEntries) {
    const memberEmbeddings = await Promise.all(
      memberIds.map(id => loadVector(db, graphId, 'topic', id))
    );

    const validMembers: string[] = [];
    const validEmbeddings: number[][] = [];

    memberIds.forEach((id, i) => {
      if (memberEmbeddings[i] !== null) {
        validMembers.push(id);
        validEmbeddings.push(memberEmbeddings[i]!);
      }
    });

    if (validEmbeddings.length === 0) continue;

    const centroidId = findSemanticMedoid(validEmbeddings, validMembers);
    const centroidTopic = topics.find(t => t.id === centroidId)!;

    clusters.push({
      id: clusterId,
      centroidId,
      memberIds: validMembers,
      centroidPosition: [centroidTopic.x, centroidTopic.y, centroidTopic.z]
    });
  }

  return clusters;
}

function generateClusterColors(count: number): string[] {
  const predefinedColors = [
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#f97316',
  ];

  if (count <= predefinedColors.length) {
    return predefinedColors.slice(0, count);
  }

  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });
}

function computeClusterEdges(cluster: ClusterInfo, allEdges: TopicEdge[]): {
  edges: TopicEdge[];
  depths: Map<string, number>;
  directions: Map<string, { from: string; to: string }>;
} {
  const memberSet = new Set(cluster.memberIds);
  const centroidId = cluster.centroidId;

  const adjacency = new Map<string, Array<{ node: string; edge: TopicEdge }>>();

  allEdges.forEach(edge => {
    if (memberSet.has(edge.src) && memberSet.has(edge.dst)) {
      if (!adjacency.has(edge.src)) adjacency.set(edge.src, []);
      if (!adjacency.has(edge.dst)) adjacency.set(edge.dst, []);
      adjacency.get(edge.src)!.push({ node: edge.dst, edge });
      adjacency.get(edge.dst)!.push({ node: edge.src, edge });
    }
  });

  const mstEdges: TopicEdge[] = [];
  const edgeDepthMap = new Map<string, number>();
  const edgeDirections = new Map<string, { from: string; to: string }>();
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [];

  visited.add(centroidId);
  queue.push({ nodeId: centroidId, depth: 0 });

  while (queue.length > 0 && visited.size < cluster.memberIds.length) {
    const { nodeId, depth } = queue.shift()!;
    const neighbors = adjacency.get(nodeId) || [];

    const sortedNeighbors = [...neighbors].sort((a, b) => b.edge.similarity - a.edge.similarity);

    sortedNeighbors.forEach(({ node, edge }) => {
      if (!visited.has(node)) {
        visited.add(node);
        mstEdges.push(edge);
        edgeDepthMap.set(edge.id, depth + 1);
        edgeDirections.set(edge.id, { from: nodeId, to: node });
        queue.push({ nodeId: node, depth: depth + 1 });
      }
    });
  }

  return { edges: mstEdges, depths: edgeDepthMap, directions: edgeDirections };
}

export function computeClustersWithEdges(
  clusters: ClusterInfo[],
  allEdges: TopicEdge[]
): ClusterWithEdges[] {
  const colors = generateClusterColors(clusters.length);

  return clusters.map((cluster, index) => {
    const { edges, depths, directions } = computeClusterEdges(cluster, allEdges);
    return {
      ...cluster,
      color: colors[index],
      edges,
      edgeDepths: depths,
      edgeDirections: directions
    };
  });
}
