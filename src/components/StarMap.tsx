// StarMap.tsx
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Stars as DreiStars, Line, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTheme } from 'next-themes';

import type { TopicSearchResult } from '@/services/search';
import type { TopicWithPosition, TopicEdge } from '@/types/schema';
import { identifyClusters, computeClustersWithEdges } from '@/services/clustering';
import type { ClusterInfo, ClusterWithEdges } from '@/services/clustering';
import { db } from '@/db/database';

interface StarMapProps {
  topics: TopicWithPosition[];
  highlightedTopics?: TopicSearchResult[];
  edges?: TopicEdge[];
  onTopicClick?: (topic: TopicWithPosition) => void;
  showAllLabels?: boolean;
  showClusters?: boolean;
  onClusterCountChange?: (count: number) => void;
}

interface StarsProps {
  topics: TopicWithPosition[];
  colorFn: (topic: TopicWithPosition) => THREE.Color | number | string;
  scaleFn: (topic: TopicWithPosition) => number;
  isDark: boolean;
  materialKey: string;
  opacity?: number;
  clickable?: boolean;
  onTopicClick?: (topic: TopicWithPosition) => void;
}

function Stars({ topics, colorFn, scaleFn, isDark, materialKey, opacity = 1, clickable = false, onTopicClick }: StarsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = topics.length;
  const [hovered, setHovered] = useState(false);
  const pointerDownTimeRef = useRef<number>(0);

  useEffect(() => {
    if (clickable) {
      document.body.style.cursor = hovered ? 'pointer' : 'default';
    }
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [hovered, clickable]);

  // temp holders
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Precompute per-instance data
  const { positions, scales, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const t = topics[i];

      positions[i * 3 + 0] = t.x;
      positions[i * 3 + 1] = t.y;
      positions[i * 3 + 2] = t.z;

      const s = scaleFn(t);
      scales[i] = s;

      const c = colorFn(t);
      tempColor.set(c as any); // accepts number | string | Color
      colors[i * 3 + 0] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    return { positions, scales, colors };
  }, [topics, colorFn, scaleFn, count]);

  useEffect(() => {
    if (!meshRef.current) return;

    for (let i = 0; i < count; i++) {
      tempObj.position.set(
        positions[i * 3 + 0],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      tempObj.scale.setScalar(scales[i]);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);

      tempColor.setRGB(
        colors[i * 3 + 0],
        colors[i * 3 + 1],
        colors[i * 3 + 2]
      );
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    if (meshRef.current.material) {
      (meshRef.current.material as THREE.Material).needsUpdate = true;
    }
  }, [positions, scales, colors, count, tempObj, tempColor, isDark]);


  const handlePointerDown = () => {
    if (clickable) {
      pointerDownTimeRef.current = Date.now();
    }
  };

  const handlePointerUp = (event: any) => {
    if (!clickable || !onTopicClick) return;

    const clickDuration = Date.now() - pointerDownTimeRef.current;
    if (clickDuration > 200) return;

    const instanceId = event.instanceId;
    if (instanceId !== undefined && instanceId < topics.length) {
      const clickedTopic = topics[instanceId];
      onTopicClick(clickedTopic);
    }
  };

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOver={() => clickable && setHovered(true)}
      onPointerOut={() => clickable && setHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <sphereGeometry args={[1, 16, 16]} />
      {isDark ? (
        <meshStandardMaterial
          key={materialKey}
          vertexColors
          emissive="#ffffff"
          emissiveIntensity={2.0}
          toneMapped={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      ) : (
        <meshBasicMaterial
          key={materialKey}
          color="#ffffff"
          transparent={opacity < 1}
          opacity={opacity}
        />
      )}
    </instancedMesh>
  );
}

interface EdgesProps {
  edges: TopicEdge[];
  topicMap: Map<string, TopicWithPosition>;
  centerNodeId: string | null;
  isDark: boolean;
  animationKey: string;
  clustersWithEdges?: ClusterWithEdges[];
  edgeDirections?: Map<string, { from: string; to: string }>;
}

interface EdgeAnimationData {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  delay: number;
  reversed: boolean;
  progress: number;
  point1: THREE.Vector3;
  point2: THREE.Vector3;
}

interface AnimatedEdgesProps {
  lines: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: string;
    opacity: number;
    delay: number;
    reversed: boolean;
  }>;
}

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

    animationDataRef.current.forEach((data, i) => {
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
            transparent
            opacity={data.opacity * data.progress}
          />
        );
      })}
    </>
  );
}

function Edges({ edges, topicMap, centerNodeId, isDark, animationKey, clustersWithEdges, edgeDirections }: EdgesProps) {
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

  const lines = useMemo(() => {
    if (!centerNodeId) {
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
      }).filter((line): line is { start: THREE.Vector3; end: THREE.Vector3; srcId: string; dstId: string; similarity: number; reversed: boolean; distance: number } =>
        line !== null
      );
    }

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
      .filter(
        (line): line is { start: THREE.Vector3; end: THREE.Vector3; srcId: string; dstId: string; similarity: number; reversed: boolean; distance: number } =>
          line !== null
      )
      .sort((a, b) => a.distance - b.distance);
  }, [edges, topicMap, centerNodeId, distances, edgeDirections]);

  if (lines.length === 0) return null;

  const defaultEdgeColor = isDark ? '#ffffff' : '#0284c7';

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

  const animatedLines = useMemo(() => {
    return lines.map(line => {
      const edgeColor = getEdgeColor(line.srcId, line.dstId);

      const baseOpacity = Math.max(0.2, (line.similarity - 0.82) * 5);
      const darkOpacity = Math.min(0.8, baseOpacity);
      const opacity = isDark ? darkOpacity : 0.8;
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
        reversed: line.reversed
      };
    });
  }, [lines, centerNodeId, isDark, clustersWithEdges]);

  return (
    <group key={animationKey}>
      <AnimatedEdges lines={animatedLines} />
    </group>
  );
}

interface LabelsProps {
  topics: TopicWithPosition[];
  isDark: boolean;
  centerNodeId: string | null;
  edges: TopicEdge[];
  animationKey: string;
  cameraPosition?: THREE.Vector3;
  showAll?: boolean;
  clusterCentroids?: string[];
  topicColorMap?: Map<string, string>;
  showClusters?: boolean;
}

function Labels({ topics, isDark, centerNodeId, edges, animationKey, cameraPosition, showAll, clusterCentroids, topicColorMap, showClusters }: LabelsProps) {
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

  const visibleLabels = useMemo(() => {
    // Always include cluster centroids
    const centroidSet = new Set(clusterCentroids || []);
    const centroids = topics.filter(t => centroidSet.has(t.id));

    if (showAll) {
      return topics;
    }

    if (cameraPosition) {
      const topicsWithScore = topics.map(topic => {
        // Centroids always get priority score
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
      const maxLabels = 5 + centroids.length;

      return topicsWithScore
        .filter(item => item.score !== Infinity && (centroidSet.has(item.topic.id) || (item.distance !== undefined && item.distance < maxDistance)))
        .slice(0, maxLabels)
        .map(item => item.topic);
    }

    // If no camera position, show centroids + first few topics
    const nonCentroids = topics.filter(t => !centroidSet.has(t.id));
    return [...centroids, ...nonCentroids.slice(0, Math.min(10, nonCentroids.length))];
  }, [topics, cameraPosition, cameraDirection, showAll, clusterCentroids]);

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

interface StaticLabelProps {
  topic: TopicWithPosition;
  textColor: string;
  isDark: boolean;
}

function StaticLabel({ topic, textColor, isDark }: StaticLabelProps) {
  const [opacity, setOpacity] = useState(0);
  const mountedRef = useRef(false);
  const position: [number, number, number] = [topic.x, topic.y - 0.6, topic.z];

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
        fontSize: '12px',
        fontWeight: 500,
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

interface AnimatedLabelProps {
  topic: TopicWithPosition;
  textColor: string;
  isDark: boolean;
  delay: number;
}

function AnimatedLabel({ topic, textColor, isDark, delay }: AnimatedLabelProps) {
  const [opacity, setOpacity] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const position: [number, number, number] = [topic.x, topic.y - 0.6, topic.z];

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
        fontSize: '12px',
        fontWeight: 500,
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

interface CameraAnimationProps {
  highlightedTopics: TopicWithPosition[];
  allTopics: TopicWithPosition[];
  onCameraUpdate?: (position: THREE.Vector3) => void;
}

function CameraAnimation({ highlightedTopics, allTopics, onCameraUpdate }: CameraAnimationProps) {
  const controlsRef = useRef<any>(null);
  const previousTargetRef = useRef<string>('');

  useFrame(({ camera }) => {
    if (onCameraUpdate) {
      onCameraUpdate(camera.position);
    }
  });

  const computeBounds = useCallback((topics: TopicWithPosition[]) => {
    if (topics.length === 0) {
      return { center: new THREE.Vector3(0, 0, 0), distance: 30 };
    }

    const bounds = {
      minX: Infinity, maxX: -Infinity,
      minY: Infinity, maxY: -Infinity,
      minZ: Infinity, maxZ: -Infinity
    };

    for (const t of topics) {
      bounds.minX = Math.min(bounds.minX, t.x);
      bounds.maxX = Math.max(bounds.maxX, t.x);
      bounds.minY = Math.min(bounds.minY, t.y);
      bounds.maxY = Math.max(bounds.maxY, t.y);
      bounds.minZ = Math.min(bounds.minZ, t.z);
      bounds.maxZ = Math.max(bounds.maxZ, t.z);
    }

    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2
    );

    const span = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    );

    const distance = topics.length === 1
      ? 15
      : span * 1.8;

    return { center, distance };
  }, []);

  const cameraTarget = useMemo(() => {
    if (highlightedTopics.length === 0) {
      return { ...computeBounds(allTopics), lookAt: null };
    }

    if (highlightedTopics.length === 1) {
      const nearest = highlightedTopics[0];
      return {
        center: new THREE.Vector3(nearest.x, nearest.y, nearest.z),
        distance: 15,
        lookAt: null
      };
    }

    const clusterBounds = computeBounds(highlightedTopics);
    const nearest = highlightedTopics[0];
    const nearestPos = new THREE.Vector3(nearest.x, nearest.y, nearest.z);
    const clusterCenter = clusterBounds.center;

    const direction = new THREE.Vector3()
      .subVectors(nearestPos, clusterCenter)
      .normalize();

    const distance = clusterBounds.distance;
    const cameraPos = new THREE.Vector3()
      .copy(nearestPos)
      .add(direction.multiplyScalar(distance));

    return {
      center: cameraPos,
      distance: 0,
      lookAt: clusterCenter
    };
  }, [highlightedTopics, allTopics, computeBounds]);

  useEffect(() => {
    if (!controlsRef.current) return;

    const highlightedIds = highlightedTopics.map(t => t.id).sort().join(',');
    const targetKey = `${highlightedIds}:${allTopics.length}`;

    if (previousTargetRef.current === targetKey) return;
    previousTargetRef.current = targetKey;

    const { center, distance, lookAt } = cameraTarget;

    if (lookAt) {
      controlsRef.current.setLookAt(
        center.x,
        center.y,
        center.z,
        lookAt.x,
        lookAt.y,
        lookAt.z,
        true
      );
    } else {
      controlsRef.current.setLookAt(
        center.x,
        center.y,
        center.z + distance,
        center.x,
        center.y,
        center.z,
        true
      );
    }
  }, [cameraTarget]);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={5}
      maxDistance={100}
      smoothTime={0.8}
      makeDefault
    />
  );
}

interface SceneProps extends StarMapProps {
  isDark: boolean;
}

interface SceneInternalProps extends SceneProps {
  clusters: ClusterInfo[];
  allEdgesForMST: TopicEdge[];
}

function Scene({ topics, highlightedTopics, edges, isDark, onTopicClick, showAllLabels, showClusters, clusters, allEdgesForMST }: SceneInternalProps) {
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 30));

  const clustersWithEdges = useMemo(() => {
    if (!showClusters || clusters.length === 0) return undefined;
    return computeClustersWithEdges(clusters, allEdgesForMST);
  }, [showClusters, clusters, allEdgesForMST]);

  const filteredClusters = useMemo(() => {
    if (!showClusters || !clustersWithEdges) return [];
    return clustersWithEdges.map((c: ClusterWithEdges) => ({
      id: c.id,
      centroidId: c.centroidId,
      memberIds: c.memberIds,
      centroidPosition: c.centroidPosition
    }));
  }, [showClusters, clustersWithEdges]);

  const clusterCentroids = useMemo(() => {
    return filteredClusters.map(c => c.centroidId);
  }, [filteredClusters]);

  const edgesToDisplay = useMemo(() => {
    if (!showClusters || !clustersWithEdges) return edges;

    const edgesWithDepth: Array<{ edge: TopicEdge; depth: number }> = [];
    const seen = new Set<string>();

    clustersWithEdges.forEach((c: ClusterWithEdges) => {
      c.edges.forEach(edge => {
        const key = edge.src < edge.dst ? `${edge.src}-${edge.dst}` : `${edge.dst}-${edge.src}`;
        if (!seen.has(key)) {
          seen.add(key);
          const depth = c.edgeDepths.get(edge.id) || 0;
          edgesWithDepth.push({ edge, depth });
        }
      });
    });

    edgesWithDepth.sort((a, b) => a.depth - b.depth);
    return edgesWithDepth.map(({ edge }) => edge);
  }, [showClusters, clustersWithEdges, edges]);

  const edgeDirectionMap = useMemo(() => {
    if (!showClusters || !clustersWithEdges) return new Map<string, { from: string; to: string }>();

    const dirMap = new Map<string, { from: string; to: string }>();
    clustersWithEdges.forEach((c: ClusterWithEdges) => {
      c.edgeDirections.forEach((dir, edgeId) => {
        dirMap.set(edgeId, dir);
      });
    });
    return dirMap;
  }, [showClusters, clustersWithEdges]);

  const highlightedIds = useMemo(() => {
    if (!highlightedTopics) return new Set<string>();
    return new Set(highlightedTopics.map(r => r.topic.id));
  }, [highlightedTopics]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicWithPosition>();
    topics.forEach(t => map.set(t.id, t));
    return map;
  }, [topics]);

  const materialKey = `${isDark ? 'dark' : 'light'}-${showClusters ? 'clustered' : 'normal'}`;
  const bgColor = isDark ? '#020617' : '#ffffff';

  // Split into two meshes: highlighted vs normal
  const { highlightedList, normalList } = useMemo(() => {
    if (!highlightedTopics || highlightedTopics.length === 0) {
      return { highlightedList: [], normalList: topics };
    }

    const highlightedList = highlightedTopics.map(r => r.topic);
    const normalList = topics.filter(t => !highlightedIds.has(t.id));

    return { highlightedList, normalList };
  }, [topics, highlightedIds, highlightedTopics]);

  // Color/scale functions
  const highlightColor = useMemo(() => new THREE.Color('#0284c7'), []);
  const defaultColor = useMemo(() => new THREE.Color('#0284c7'), []);
  const orphanColor = useMemo(() => new THREE.Color(isDark ? '#404040' : '#707070'), [isDark]);

  // Map topic IDs to cluster colors
  const topicColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (clustersWithEdges) {
      for (const cluster of clustersWithEdges) {
        for (const memberId of cluster.memberIds) {
          if (map.has(memberId)) {
            console.warn(`Topic ${memberId} appears in multiple clusters: existing color ${map.get(memberId)}, new color ${cluster.color}`);
          }
          map.set(memberId, cluster.color);
        }
      }
    }
    return map;
  }, [clustersWithEdges]);

  const colorFnHighlighted = useCallback(() => highlightColor, [highlightColor]);
  const colorFnNormal = useCallback((topic: TopicWithPosition) => {
    if (showClusters) {
      const clusterColor = topicColorMap.get(topic.id);
      return clusterColor || orphanColor;
    }
    return defaultColor;
  }, [showClusters, topicColorMap, defaultColor, orphanColor]);

  const scaleFnHighlighted = useCallback((topic: TopicWithPosition) => {
    const minScale = 0.12;
    const maxScale = 0.25;
    const usesScale = Math.min(topic.uses / 20, 1);
    return minScale + (maxScale - minScale) * usesScale;
  }, []);

  const scaleFnNormal = useCallback((topic: TopicWithPosition) => {
    const baseMin = isDark ? 0.06 : 0.08;
    const baseMax = isDark ? 0.15 : 0.18;
    const usesScale = Math.min(topic.uses / 20, 1);
    return baseMin + (baseMax - baseMin) * usesScale;
  }, [isDark]);

  const normalOpacity = highlightedList.length > 0
    ? (isDark ? 0.2 : 0.6)
    : 1.0;

  const centerNodeId = useMemo(() => {
    if (!highlightedTopics || highlightedTopics.length === 0) return null;
    const highest = highlightedTopics.reduce((max, current) =>
      current.similarity > max.similarity ? current : max
    );
    return highest.topic.id;
  }, [highlightedTopics]);

  const edgeAnimationKey = useMemo(() => {
    if (showClusters && clustersWithEdges) {
      return `clusters-${clustersWithEdges.length}`;
    }
    if (highlightedList.length > 0) {
      return highlightedList.map(t => t.id).sort().join(',');
    }
    return edges ? `all-edges-${edges.length}` : 'no-edges';
  }, [highlightedList, edges, showClusters, clustersWithEdges]);

  return (
    <>
      <color attach="background" args={[bgColor]} />

      {/* Background starfield - only in dark mode */}
      {isDark && (
        <DreiStars
          radius={150}
          depth={50}
          count={10000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
      )}

      {highlightedList.length > 0 && edges && (
        <Labels
          topics={highlightedList}
          isDark={isDark}
          centerNodeId={centerNodeId}
          edges={edges}
          animationKey={edgeAnimationKey}
          showClusters={showClusters}
        />
      )}

      {highlightedList.length === 0 && (
        <Labels
          topics={topics}
          isDark={isDark}
          centerNodeId={null}
          edges={[]}
          animationKey="proximity"
          cameraPosition={cameraPosition}
          showAll={showAllLabels}
          clusterCentroids={clusterCentroids}
          topicColorMap={topicColorMap}
          showClusters={showClusters}
        />
      )}

      <Stars
        topics={normalList}
        colorFn={colorFnNormal}
        scaleFn={scaleFnNormal}
        isDark={isDark}
        materialKey={materialKey + '-normal'}
        opacity={normalOpacity}
        clickable={true}
        onTopicClick={onTopicClick}
      />

      {highlightedList.length > 0 && (
        <Stars
          topics={highlightedList}
          colorFn={colorFnHighlighted}
          scaleFn={scaleFnHighlighted}
          isDark={isDark}
          materialKey={materialKey + '-highlight'}
          opacity={1}
          clickable={true}
          onTopicClick={onTopicClick}
        />
      )}

      {edgesToDisplay && edgesToDisplay.length > 0 && (
        <Edges edges={edgesToDisplay} topicMap={topicMap} centerNodeId={centerNodeId} isDark={isDark} animationKey={edgeAnimationKey} clustersWithEdges={clustersWithEdges} edgeDirections={edgeDirectionMap} />
      )}

      <CameraAnimation
        highlightedTopics={highlightedList}
        allTopics={topics}
        onCameraUpdate={setCameraPosition}
      />
    </>
  );
}

export function StarMap({ topics, highlightedTopics, edges, onTopicClick, showAllLabels, showClusters, onClusterCountChange }: StarMapProps) {
  const [bloomReady, setBloomReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(true);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [allEdges, setAllEdges] = useState<TopicEdge[]>([]);

  useEffect(() => {
    setBloomReady(true);

    const checkTheme = () => {
      const htmlElement = document.documentElement;
      const domIsDark = htmlElement.classList.contains('dark');
      const themeIsDark = resolvedTheme === 'dark';
      const actualIsDark = domIsDark || themeIsDark;
      setIsDark(actualIsDark);
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [resolvedTheme]);

  useEffect(() => {
    setIsReady(false);
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [topics.length]);

  const topicsKey = useMemo(() => {
    return topics.map(t => t.id).sort().join(',');
  }, [topics]);

  useEffect(() => {
    identifyClusters(topics).then(setClusters);
  }, [topicsKey]);

  useEffect(() => {
    db.topic_edges.toArray().then(setAllEdges);
  }, []);

  useEffect(() => {
    if (onClusterCountChange) {
      onClusterCountChange(clusters.length);
    }
  }, [clusters.length, onClusterCountChange]);

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No topics to visualize
      </div>
    );
  }

  return (
    <div
      className="w-full h-full transition-opacity duration-500"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <Canvas
        gl={{
          antialias: true,
          toneMapping: isDark ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping,
          toneMappingExposure: isDark ? 1 : 1
        }}
      >
      <Scene
        topics={topics}
        highlightedTopics={highlightedTopics}
        edges={edges}
        isDark={isDark}
        onTopicClick={onTopicClick}
        showAllLabels={showAllLabels}
        showClusters={showClusters}
        clusters={clusters}
        allEdgesForMST={allEdges}
      />
      {bloomReady && (
        <EffectComposer>
          <Bloom
            kernelSize={isDark ? 4 : 5}
            luminanceThreshold={isDark ? 0.5 : 0.8}
            luminanceSmoothing={0.4}
            intensity={isDark ? 0.6 : 0.8}
            radius={isDark ? 0.4 : 0.6}
          />
        </EffectComposer>
      )}
    </Canvas>
    </div>
  );
}
