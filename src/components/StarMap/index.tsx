import { useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars as DreiStars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTheme } from 'next-themes';

import type { StarMapProps, SceneInternalProps } from './types';
import type { TopicWithPosition, TopicEdge } from '@/types/schema';
import { identifyClusters, computeClustersWithEdges } from '@/services/clustering';
import type { ClusterInfo, ClusterWithEdges } from '@/services/clustering';
import { db } from '@/db/database';

import { Stars } from './Stars';
import { Edges } from './Edges';
import { Labels } from './Labels';
import { CameraAnimation } from './CameraAnimation';

/**
 * Scene component that renders the 3D visualization
 * Manages cluster computation, colors, and component composition
 */
function Scene({
  topics,
  highlightedTopics,
  edges,
  isDark,
  onTopicClick,
  showAllLabels,
  showClusters,
  clusters,
  allEdgesForMST
}: SceneInternalProps) {
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

  const bgColor = isDark ? '#020617' : '#ffffff';
  const defaultColor = useMemo(() => new THREE.Color('#0284c7'), []);
  const orphanColor = useMemo(() => new THREE.Color(isDark ? '#404040' : '#707070'), [isDark]);

  const topicColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (clustersWithEdges) {
      for (const cluster of clustersWithEdges) {
        for (const memberId of cluster.memberIds) {
          map.set(memberId, cluster.color);
        }
      }
    }
    return map;
  }, [clustersWithEdges]);

  const colorFn = useCallback((topic: TopicWithPosition) => {
    if (showClusters) {
      const clusterColor = topicColorMap.get(topic.id);
      return clusterColor || orphanColor;
    }
    return defaultColor;
  }, [showClusters, topicColorMap, defaultColor, orphanColor]);

  const calculateScale = useCallback((topic: TopicWithPosition, isHighlighted: boolean) => {
    const usesScale = Math.min(topic.uses / 20, 1);
    if (isHighlighted) {
      return 0.12 + (0.25 - 0.12) * usesScale;
    }
    const baseMin = isDark ? 0.06 : 0.08;
    const baseMax = isDark ? 0.15 : 0.18;
    return baseMin + (baseMax - baseMin) * usesScale;
  }, [isDark]);

  const scaleFn = useCallback((topic: TopicWithPosition) => {
    return calculateScale(topic, highlightedIds.has(topic.id));
  }, [highlightedIds, calculateScale]);

  const centerNodeId = useMemo(() => {
    if (!highlightedTopics || highlightedTopics.length === 0) return null;
    const highest = highlightedTopics.reduce((max, current) =>
      current.similarity > max.similarity ? current : max
    );
    return highest.topic.id;
  }, [highlightedTopics]);

  const highlightedList = useMemo(() => {
    if (!highlightedTopics || highlightedTopics.length === 0) return [];
    return highlightedTopics.map(r => r.topic);
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

      <Stars
        topics={highlightedList.length > 0 ? topics.filter(t => !highlightedIds.has(t.id)) : topics}
        colorFn={colorFn}
        scaleFn={scaleFn}
        isDark={isDark}
        opacity={highlightedList.length > 0 ? (isDark ? 0.2 : 0.6) : 1}
        clickable={highlightedList.length === 0}
        onTopicClick={onTopicClick}
      />

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

      {highlightedList.length > 0 && (
        <group key={highlightedList.map(t => t.id).join(',')}>
          {highlightedList.map((topic) => {
            const scale = calculateScale(topic, true);
            return (
              <mesh
                key={topic.id}
                position={[topic.x, topic.y, topic.z]}
                scale={[scale, scale, scale]}
                onClick={() => {
                  onTopicClick?.(topic);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'default';
                }}
              >
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial
                  emissive={isDark ? "#ffffff" : '#0284c7'}
                  emissiveIntensity={isDark ? 3.5 : 1.5}
                  toneMapped={false}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {edgesToDisplay && edgesToDisplay.length > 0 && (
        <Edges
          edges={edgesToDisplay}
          topicMap={topicMap}
          centerNodeId={centerNodeId}
          isDark={isDark}
          animationKey={edgeAnimationKey}
          clustersWithEdges={clustersWithEdges}
          edgeDirections={edgeDirectionMap}
        />
      )}

      <CameraAnimation
        highlightedTopics={highlightedList}
        allTopics={topics}
        onCameraUpdate={setCameraPosition}
      />
    </>
  );
}

/**
 * StarMap - 3D knowledge graph visualization component
 * Renders topics as nodes in 3D space with animated edges and labels
 */
export function StarMap({
  graphId,
  topics,
  highlightedTopics,
  edges,
  onTopicClick,
  showAllLabels,
  showClusters,
  onClusterCountChange
}: StarMapProps) {
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
    identifyClusters(graphId, topics).then(setClusters);
  }, [graphId, topicsKey, topics]);

  useEffect(() => {
    db.topic_edges.where('graphId').equals(graphId).toArray().then(setAllEdges);
  }, [graphId, topicsKey]);

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
        camera={{ near: 0.01, far: 1000 }}
        gl={{
          antialias: true,
          toneMapping: isDark ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping,
          toneMappingExposure: isDark ? 1 : 1
        }}
      >
        <Scene
          graphId={graphId}
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
              intensity={isDark ? 0.6 : 0.0}
              radius={isDark ? 0.4 : 0.6}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
