import { db } from '../db/database';
import type { TopicWithPosition, TopicEdge } from '../types/schema';

export interface ClusterInfo {
  id: number;
  centroidId: string;
  memberIds: string[];
  centroidPosition: [number, number, number];
}

export interface ClusterWithEdges extends ClusterInfo {
  color: string;
  edges: TopicEdge[];
}

function buildAdjacencyList(topics: TopicWithPosition[], edges: TopicEdge[], minSimilarity: number): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  topics.forEach(t => graph.set(t.id, []));

  edges
    .filter(e => e.similarity >= minSimilarity)
    .forEach(e => {
      if (graph.has(e.src) && graph.has(e.dst)) {
        graph.get(e.src)!.push(e.dst);
        graph.get(e.dst)!.push(e.src);
      }
    });

  return graph;
}

function findConnectedComponents(topics: TopicWithPosition[], graph: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const topic of topics) {
    if (visited.has(topic.id)) continue;

    const cluster: string[] = [];
    const queue: string[] = [topic.id];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;

      visited.add(id);
      cluster.push(id);

      const neighbors = graph.get(id) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

function findMostConnectedNode(clusterIds: string[], edges: TopicEdge[]): string {
  const edgeCount = new Map<string, number>();
  clusterIds.forEach(id => edgeCount.set(id, 0));

  const clusterSet = new Set(clusterIds);

  for (const edge of edges) {
    if (clusterSet.has(edge.src) && clusterSet.has(edge.dst)) {
      edgeCount.set(edge.src, (edgeCount.get(edge.src) || 0) + 1);
      edgeCount.set(edge.dst, (edgeCount.get(edge.dst) || 0) + 1);
    }
  }

  let maxEdges = -1;
  let centroidId = clusterIds[0];

  for (const id of clusterIds) {
    const count = edgeCount.get(id) || 0;
    if (count > maxEdges) {
      maxEdges = count;
      centroidId = id;
    }
  }

  return centroidId;
}

export async function identifyClusters(topics: TopicWithPosition[]): Promise<ClusterInfo[]> {
  if (topics.length < 2) return [];

  const edges = await db.topic_edges.toArray();
  const graph = buildAdjacencyList(topics, edges, 0);
  const clusterIdArrays = findConnectedComponents(topics, graph);

  const clusters: ClusterInfo[] = [];
  const topicMap = new Map(topics.map(t => [t.id, t]));

  for (let i = 0; i < clusterIdArrays.length; i++) {
    const clusterIds = clusterIdArrays[i];
    const centroidId = findMostConnectedNode(clusterIds, edges);
    const centroidTopic = topicMap.get(centroidId);

    if (centroidTopic) {
      clusters.push({
        id: i,
        centroidId,
        memberIds: clusterIds,
        centroidPosition: [centroidTopic.x, centroidTopic.y, centroidTopic.z]
      });
    }
  }

  return clusters;
}

export function getOrbitDataForTopic(
  topicId: string,
  clusters: ClusterInfo[]
): { centroid: [number, number, number]; isCentroid: boolean } | null {
  for (const cluster of clusters) {
    if (cluster.centroidId === topicId) {
      return { centroid: cluster.centroidPosition, isCentroid: true };
    }
    if (cluster.memberIds.includes(topicId)) {
      return { centroid: cluster.centroidPosition, isCentroid: false };
    }
  }
  return null;
}


function generateClusterColors(count: number): string[] {
  const predefinedColors = [
    'hsl(0, 70%, 60%)',
    'hsl(210, 70%, 60%)',
    'hsl(120, 70%, 50%)',
    'hsl(45, 70%, 60%)',
    'hsl(280, 70%, 60%)',
    'hsl(30, 70%, 60%)',
  ];

  if (count <= predefinedColors.length) {
    return predefinedColors.slice(0, count);
  }

  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 360) / count;
    return `hsl(${hue}, 70%, 60%)`;
  });
}

function filterConnectedMembers(cluster: ClusterInfo, allEdges: TopicEdge[]): string[] {
  const memberSet = new Set(cluster.memberIds);
  const centroidId = cluster.centroidId;

  // Find nodes with direct edges to centroid
  const directlyConnected = new Set<string>([centroidId]);

  for (const edge of allEdges) {
    if ((edge.src === centroidId && memberSet.has(edge.dst)) ||
        (edge.dst === centroidId && memberSet.has(edge.src))) {
      const connectedNode = edge.src === centroidId ? edge.dst : edge.src;
      directlyConnected.add(connectedNode);
    }
  }

  return Array.from(directlyConnected);
}

function computeClusterEdges(cluster: ClusterInfo, allEdges: TopicEdge[]): TopicEdge[] {
  const memberSet = new Set(cluster.memberIds);
  const centroidId = cluster.centroidId;

  // Get all edges within the cluster
  const clusterEdges = allEdges.filter(e =>
    memberSet.has(e.src) && memberSet.has(e.dst)
  );

  // Only return edges where centroid is one endpoint
  return clusterEdges.filter(e =>
    e.src === centroidId || e.dst === centroidId
  );
}

export function computeClustersWithEdges(
  clusters: ClusterInfo[],
  allEdges: TopicEdge[]
): ClusterWithEdges[] {
  const colors = generateClusterColors(clusters.length);

  return clusters.map((cluster, index) => {
    const connectedMembers = filterConnectedMembers(cluster, allEdges);
    const filteredCluster: ClusterInfo = {
      ...cluster,
      memberIds: connectedMembers
    };

    return {
      ...filteredCluster,
      color: colors[index],
      edges: computeClusterEdges(filteredCluster, allEdges)
    };
  });
}
