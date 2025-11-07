import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LabelsProps, StaticLabelProps, AnimatedLabelProps } from './types';

/**
 * Static label component with fade-in animation
 */
function StaticLabel({ topic, textColor, isDark }: StaticLabelProps) {
  const [opacity, setOpacity] = useState(0);
  const mountedRef = useRef(false);
  const position: [number, number, number] = [topic.x, topic.y - 0.6, topic.z];
  const fontSize = useMemo(() => 11 * (window.devicePixelRatio || 1), []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const timer = setTimeout(() => setOpacity(1), 50);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, [topic.id]);

  return (
    <Html
      position={position}
      center
      sprite
      transform
      occlude={false}
      zIndexRange={[100, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        opacity,
        transition: 'opacity 0.5s ease-in-out'
      }}
    >
      <div style={{
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        textShadow: isDark
          ? '0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)'
          : '0 0 8px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)'
      }}>
        {topic.label}
      </div>
    </Html>
  );
}

/**
 * Animated label component with frame-based delay
 */
function AnimatedLabel({ topic, textColor, isDark, delay }: AnimatedLabelProps) {
  const [opacity, setOpacity] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const position: [number, number, number] = [topic.x, topic.y - 0.6, topic.z];
  const fontSize = useMemo(() => 11 * (window.devicePixelRatio || 1), []);

  useFrame(({ clock }) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime();
    }

    const elapsed = clock.getElapsedTime() - startTimeRef.current;
    const timeSinceDelay = elapsed - delay;

    if (timeSinceDelay < 0) {
      setOpacity(0);
    } else if (timeSinceDelay < 0.3) {
      setOpacity(timeSinceDelay / 0.3);
    } else {
      setOpacity(1);
    }
  });

  return (
    <Html
      position={position}
      center
      sprite
      transform
      occlude={false}
      zIndexRange={[100, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        opacity
      }}
    >
      <div style={{
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        textShadow: isDark
          ? '0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)'
          : '0 0 8px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)'
      }}>
        {topic.label}
      </div>
    </Html>
  );
}

/**
 * Labels component with camera-based visibility culling and animation
 */
export function Labels({
  topics,
  isDark,
  centerNodeId,
  edges,
  animationKey,
  cameraPosition,
  showAll,
  clusterCentroids,
  topicColorMap,
  showClusters
}: LabelsProps) {
  const defaultTextColor = isDark ? '#ffffff' : '#0284c7';
  const [cameraDirection, setCameraDirection] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, -1));

  const getTextColor = useCallback((topicId: string): string => {
    if (showClusters && topicColorMap) {
      const clusterColor = topicColorMap.get(topicId);
      if (clusterColor) return clusterColor;
      return isDark ? '#808080' : '#606060';
    }
    return defaultTextColor;
  }, [showClusters, isDark, topicColorMap, defaultTextColor]);

  useFrame(({ camera }) => {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    setCameraDirection(direction.clone());
  });

  // Select visible labels based on camera proximity and cluster centroids
  const visibleLabels = useMemo(() => {
    const centroidSet = new Set(clusterCentroids || []);
    const centroids = topics.filter(t => centroidSet.has(t.id));

    if (showAll) {
      return topics;
    }

    if (cameraPosition) {
      const topicsWithScore = topics.map(topic => {
        // Centroids always get priority
        if (centroidSet.has(topic.id)) {
          return { topic, score: -1, distance: 0 };
        }

        const toNode = new THREE.Vector3(
          topic.x - cameraPosition.x,
          topic.y - cameraPosition.y,
          topic.z - cameraPosition.z
        );

        const distanceFromCamera = toNode.length();
        const forwardDist = toNode.dot(cameraDirection);

        if (forwardDist < 0) {
          return { topic, score: Infinity };
        }

        const perpVec = toNode.clone().addScaledVector(cameraDirection, -forwardDist);
        const perpDist = perpVec.length();

        const viewScore = forwardDist + perpDist * 2;

        return { topic, score: viewScore, distance: distanceFromCamera };
      });

      topicsWithScore.sort((a, b) => a.score - b.score);

      const maxDistance = 30;
      const maxLabels = 3 + centroids.length;

      return topicsWithScore
        .filter(item => item.score !== Infinity && (centroidSet.has(item.topic.id) || (item.distance !== undefined && item.distance < maxDistance)))
        .slice(0, maxLabels)
        .map(item => item.topic);
    }

    // No camera position - show centroids + first few topics
    const nonCentroids = topics.filter(t => !centroidSet.has(t.id));
    return [...centroids, ...nonCentroids.slice(0, Math.min(10, nonCentroids.length))];
  }, [topics, cameraPosition, cameraDirection, showAll, clusterCentroids]);

  // Compute BFS distances for animation ordering
  const labelDistances = useMemo(() => {
    if (!centerNodeId || edges.length === 0) {
      return new Map<string, number>();
    }

    const adjacency = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!adjacency.has(edge.src)) adjacency.set(edge.src, new Set());
      if (!adjacency.has(edge.dst)) adjacency.set(edge.dst, new Set());
      adjacency.get(edge.src)!.add(edge.dst);
      adjacency.get(edge.dst)!.add(edge.src);
    });

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
  }, [centerNodeId, edges]);

  const useAnimation = centerNodeId !== null && edges.length > 0;

  return (
    <group key={animationKey}>
      {visibleLabels.map((topic) => {
        const distance = labelDistances.get(topic.id) ?? 0;
        const animationDuration = 0.5;
        const delay = useAnimation ? 1.0 + distance * (animationDuration + 0.05) : 0;
        const textColor = getTextColor(topic.id);

        return useAnimation ? (
          <AnimatedLabel
            key={topic.id}
            topic={topic}
            textColor={textColor}
            isDark={isDark}
            delay={delay}
          />
        ) : (
          <StaticLabel
            key={topic.id}
            topic={topic}
            textColor={textColor}
            isDark={isDark}
          />
        );
      })}
    </group>
  );
}
