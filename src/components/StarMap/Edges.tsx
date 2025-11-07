import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { EdgesProps, AnimatedEdgesProps, EdgeAnimationData } from './types';
import type { ClusterWithEdges } from '@/services/clustering';
import type { TopicEdge } from '@/types/schema';

/**
 * Animated edges component that draws lines with sequential animation
 */
function AnimatedEdges({ lines }: AnimatedEdgesProps) {
  const startTimeRef = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);
  const animationDataRef = useRef<EdgeAnimationData[]>([]);

  if (animationDataRef.current.length !== lines.length) {
    animationDataRef.current = lines.map(line => ({
      ...line,
      progress: 0,
      point1: new THREE.Vector3(),
      point2: new THREE.Vector3()
    }));
  } else {
    // Update colors and opacity without resetting animation
    lines.forEach((line, i) => {
      if (animationDataRef.current[i]) {
        animationDataRef.current[i].color = line.color;
        animationDataRef.current[i].opacity = line.opacity;
        animationDataRef.current[i].isClusterEdge = line.isClusterEdge;
      }
    });
  }

  useFrame(({ clock }) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime();
    }

    const animationDuration = 0.5;
    const currentTime = clock.getElapsedTime();
    let needsUpdate = false;

    animationDataRef.current.forEach((data) => {
      const elapsed = currentTime - startTimeRef.current! - data.delay;
      if (elapsed < 0) return;

      const newProgress = Math.min(1, elapsed / animationDuration);
      if (newProgress !== data.progress) {
        data.progress = newProgress;
        needsUpdate = true;

        const tempVec = new THREE.Vector3();
        if (data.reversed) {
          tempVec.lerpVectors(data.end, data.start, newProgress);
          data.point1.copy(tempVec);
          data.point2.copy(data.end);
        } else {
          tempVec.lerpVectors(data.start, data.end, newProgress);
          data.point1.copy(data.start);
          data.point2.copy(tempVec);
        }
      }
    });

    if (needsUpdate) {
      forceUpdate(prev => prev + 1);
    }
  });

  return (
    <>
      {animationDataRef.current.map((data, i) => {
        if (data.progress === 0) return null;
        return (
          <Line
            key={i}
            points={[data.point1, data.point2]}
            color={data.color}
            lineWidth={2}
            transparent={true}
            opacity={data.opacity * data.progress}
          />
        );
      })}
    </>
  );
}

/**
 * Edges component that manages graph edge rendering with BFS-ordered animation
 */
export function Edges({
  edges,
  topicMap,
  centerNodeId,
  isDark,
  animationKey,
  clustersWithEdges,
  edgeDirections
}: EdgesProps) {
  // Build adjacency list for BFS traversal
  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!adj.has(edge.src)) adj.set(edge.src, new Set());
      if (!adj.has(edge.dst)) adj.set(edge.dst, new Set());
      adj.get(edge.src)!.add(edge.dst);
      adj.get(edge.dst)!.add(edge.src);
    });
    return adj;
  }, [edges]);

  // BFS to compute distances from center node for animation ordering
  const distances = useMemo(() => {
    if (!centerNodeId) return new Map<string, number>();

    const dist = new Map<string, number>();
    const queue: string[] = [centerNodeId];
    dist.set(centerNodeId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = dist.get(current)!;
      const neighbors = adjacency.get(current) || new Set();

      neighbors.forEach(neighbor => {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      });
    }

    return dist;
  }, [centerNodeId, adjacency]);

  // Convert edges to lines with positions and animation metadata
  const lines = useMemo(() => {
    if (!centerNodeId) {
      // No center node - simple ordering by index
      return edges.map((edge, index) => {
        const src = topicMap.get(edge.src);
        const dst = topicMap.get(edge.dst);
        if (!src || !dst) return null;

        const direction = edgeDirections?.get(edge.id);
        const reversed = direction ? direction.to === edge.src : false;

        return {
          start: new THREE.Vector3(src.x, src.y, src.z),
          end: new THREE.Vector3(dst.x, dst.y, dst.z),
          srcId: edge.src,
          dstId: edge.dst,
          similarity: edge.similarity,
          reversed,
          distance: index
        };
      }).filter((line): line is NonNullable<typeof line> => line !== null);
    }

    // With center node - BFS-ordered animation
    return edges
      .map(edge => {
        const src = topicMap.get(edge.src);
        const dst = topicMap.get(edge.dst);
        if (!src || !dst) return null;

        const srcDist = distances.get(edge.src) ?? Infinity;
        const dstDist = distances.get(edge.dst) ?? Infinity;

        const reversed = dstDist < srcDist;
        const distance = Math.min(srcDist, dstDist);

        return {
          start: new THREE.Vector3(src.x, src.y, src.z),
          end: new THREE.Vector3(dst.x, dst.y, dst.z),
          srcId: edge.src,
          dstId: edge.dst,
          similarity: edge.similarity,
          reversed,
          distance
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)
      .sort((a, b) => a.distance - b.distance);
  }, [edges, topicMap, centerNodeId, distances, edgeDirections]);

  if (lines.length === 0) return null;

  const defaultEdgeColor = isDark ? '#ffffff' : '#0284c7';

  // Get edge color from cluster if available
  const getEdgeColor = (srcId: string, dstId: string): string => {
    if (!clustersWithEdges) return defaultEdgeColor;

    const cluster = clustersWithEdges.find((c: ClusterWithEdges) =>
      c.edges.some((e: TopicEdge) =>
        (e.src === srcId && e.dst === dstId) ||
        (e.src === dstId && e.dst === srcId)
      )
    );
    return cluster?.color || defaultEdgeColor;
  };

  // Prepare animated lines with colors, opacity, and delays
  const animatedLines = useMemo(() => {
    return lines.map(line => {
      const edgeColor = getEdgeColor(line.srcId, line.dstId);
      const isClusterEdge = edgeColor !== defaultEdgeColor;

      let opacity: number;
      if (isClusterEdge) {
        opacity = 0.8;
      } else {
        const baseOpacity = Math.max(0.2, (line.similarity - 0.6) * 2.5);
        const darkOpacity = Math.min(0.8, baseOpacity);
        opacity = isDark ? darkOpacity : 0.8;
      }

      const animationDuration = 0.5;
      const delay = centerNodeId
        ? 1.0 + line.distance * (animationDuration + 0.05)
        : 0.5 + (line.distance * 0.01);

      return {
        start: line.start,
        end: line.end,
        color: edgeColor,
        opacity,
        delay,
        reversed: line.reversed,
        isClusterEdge
      };
    });
  }, [lines, centerNodeId, isDark, clustersWithEdges, defaultEdgeColor]);

  return (
    <group key={animationKey} raycast={() => null}>
      <AnimatedEdges lines={animatedLines} />
    </group>
  );
}
