// StarMap.tsx
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Stars as DreiStars, Line, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTheme } from 'next-themes';

import type { TopicSearchResult } from '@/services/search';
import type { TopicWithPosition, TopicEdge } from '@/types/schema';

interface StarMapProps {
  topics: TopicWithPosition[];
  highlightedTopics?: TopicSearchResult[];
  edges?: TopicEdge[];
  onTopicClick?: (topic: TopicWithPosition) => void;
}

interface StarsProps {
  topics: TopicWithPosition[];
  colorFn: (topic: TopicWithPosition) => THREE.Color | number | string;
  scaleFn: (topic: TopicWithPosition) => number;
  isDark: boolean;
  /** Recreate material when this key changes (e.g., theme flip) */
  materialKey: string;
  /** Optional global opacity for this mesh (applies to all its instances) */
  opacity?: number;
  /** Make stars clickable */
  clickable?: boolean;
  /** Click handler */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, colorFn, scaleFn, isDark, count]);

  // Write matrices + colors once (or when deps change)
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

    // Nudge material/program cache when theme switches
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
  isDark: boolean;
}

function Edges({ edges, topicMap, isDark }: EdgesProps) {
  const lines = useMemo(() => {
    return edges
      .map(edge => {
        const src = topicMap.get(edge.src);
        const dst = topicMap.get(edge.dst);
        if (!src || !dst) return null;

        return {
          points: [
            new THREE.Vector3(src.x, src.y, src.z),
            new THREE.Vector3(dst.x, dst.y, dst.z)
          ],
          similarity: edge.similarity
        };
      })
      .filter(
        (line): line is { points: THREE.Vector3[]; similarity: number } =>
          line !== null
      );
  }, [edges, topicMap]);

  if (lines.length === 0) return null;

  const edgeColor = isDark ? '#ffffff' : '#0284c7';

  return (
    <group>
      {lines.map((line, i) => {
        const baseOpacity = Math.max(0.2, (line.similarity - 0.5) * 2);
        const opacity = Math.min(0.8, baseOpacity);
        return (
          <Line
            key={i}
            points={line.points}
            color={edgeColor}
            lineWidth={2}
            transparent
            opacity={opacity}
          />
        );
      })}
    </group>
  );
}

interface LabelsProps {
  topics: TopicWithPosition[];
  isDark: boolean;
}

function Labels({ topics, isDark }: LabelsProps) {
  const textColor = isDark ? '#ffffff' : '#0284c7';

  return (
    <group>
      {topics.map((topic) => (
        <Html
          key={topic.id}
          position={[topic.x, topic.y - 0.6, topic.z]}
          center
          sprite
          transform
          occlude
          zIndexRange={[100, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
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
      ))}
    </group>
  );
}

interface CameraAnimationProps {
  highlightedTopics: TopicWithPosition[];
  allTopics: TopicWithPosition[];
}

function CameraAnimation({ highlightedTopics, allTopics }: CameraAnimationProps) {
  const controlsRef = useRef<any>(null);

  const computeBounds = (topics: TopicWithPosition[]) => {
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
      bounds.maxY - bounds.maxY,
      bounds.maxZ - bounds.minZ
    );

    const distance = topics.length === 1
      ? 15
      : Math.max(35, span * 2.5);

    return { center, distance };
  };

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

    const distance = 15;
    const cameraPos = new THREE.Vector3()
      .copy(nearestPos)
      .add(direction.multiplyScalar(distance));

    return {
      center: cameraPos,
      distance: 0,
      lookAt: clusterCenter
    };
  }, [highlightedTopics, allTopics]);

  useEffect(() => {
    if (!controlsRef.current) return;

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
    />
  );
}

interface SceneProps extends StarMapProps {
  isDark: boolean;
}

function Scene({ topics, highlightedTopics, edges, isDark, onTopicClick }: SceneProps) {
  const highlightedIds = useMemo(() => {
    if (!highlightedTopics) return new Set<string>();
    return new Set(highlightedTopics.map(r => r.topic.id));
  }, [highlightedTopics]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicWithPosition>();
    topics.forEach(t => map.set(t.id, t));
    return map;
  }, [topics]);

  const materialKey = isDark ? 'dark' : 'light';
  const bgColor = isDark ? '#020617' : '#ffffff';

  // Split into two meshes: highlighted vs normal (so we can dim non-highlighted)
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
  const colorFnHighlighted = () => highlightColor;
  const colorFnNormal = () => {
    return new THREE.Color('#0284c7');
  };

  const scaleFnHighlighted = () => 0.15;
  const scaleFnNormal = () => (isDark ? 0.08 : 0.12);

  // Dim normal stars when there are highlights
  const normalOpacity = highlightedList.length > 0
    ? (isDark ? 0.2 : 0.6)
    : 1.0;

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

      {highlightedList.length > 0 && (
        <Labels topics={highlightedList} isDark={isDark} />
      )}

      {/* Normal stars */}
      <Stars
        topics={normalList}
        colorFn={colorFnNormal}
        scaleFn={scaleFnNormal}
        isDark={isDark}
        materialKey={materialKey + '-normal'}
        opacity={normalOpacity}
      />

      {/* Highlighted stars */}
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

      {edges && edges.length > 0 && (
        <Edges edges={edges} topicMap={topicMap} isDark={isDark} />
      )}

      <CameraAnimation highlightedTopics={highlightedList} allTopics={topics} />
    </>
  );
}

export function StarMap({ topics, highlightedTopics, edges, onTopicClick }: StarMapProps) {
  const [bloomReady, setBloomReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setBloomReady(true);

    // Set initial theme state + watch for html.class changes
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

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No topics to visualize
      </div>
    );
  }

  return (
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
  );
}
