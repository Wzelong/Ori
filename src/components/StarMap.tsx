// StarMap.tsx
import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
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
}

function Stars({ topics, colorFn, scaleFn, isDark, materialKey, opacity = 1 }: StarsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = topics.length;

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

    console.log('[Stars useEffect] Applying colors - isDark:', isDark, 'count:', count, 'first 3 colors:',
      colors.slice(0, 9));

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
      console.log('[Stars useEffect] instanceColor updated, exists:', !!meshRef.current.instanceColor);
    } else {
      console.log('[Stars useEffect] WARNING: instanceColor is null!');
    }

    // Nudge material/program cache when theme switches
    if (meshRef.current.material) {
      (meshRef.current.material as THREE.Material).needsUpdate = true;
    }
  }, [positions, scales, colors, count, tempObj, tempColor, isDark]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
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
  target?: TopicWithPosition;
}

function CameraAnimation({ target }: CameraAnimationProps) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (target && controlsRef.current) {
      const distance = 15;
      const offsetY = 3;
      controlsRef.current.setLookAt(
        target.x,
        target.y + offsetY,
        target.z + distance,
        target.x,
        target.y,
        target.z,
        true
      );
    } else if (!target && controlsRef.current) {
      controlsRef.current.setLookAt(0, 0, 30, 0, 0, 0, true);
    }
  }, [target]);

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

function Scene({ topics, highlightedTopics, edges, isDark }: SceneProps) {
  const highlightedIds = useMemo(() => {
    if (!highlightedTopics) return new Set<string>();
    return new Set(highlightedTopics.map(r => r.topic.id));
  }, [highlightedTopics]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicWithPosition>();
    topics.forEach(t => map.set(t.id, t));
    return map;
  }, [topics]);

  const nearestTopic = highlightedTopics?.[0]?.topic;
  const materialKey = isDark ? 'dark' : 'light';
  const bgColor = isDark ? '#020617' : '#ffffff';

  // Split into two meshes: highlighted vs normal (so we can dim non-highlighted)
  const { highlightedList, normalList } = useMemo(() => {
    const highlightedList: TopicWithPosition[] = [];
    const normalList: TopicWithPosition[] = [];
    for (const t of topics) {
      if (highlightedIds.has(t.id)) highlightedList.push(t);
      else normalList.push(t);
    }
    return { highlightedList, normalList };
  }, [topics, highlightedIds]);

  // Color/scale functions
  const highlightColor = useMemo(() => new THREE.Color('#0284c7'), []);
  const colorFnHighlighted = () => highlightColor;
  const colorFnNormal = (t: TopicWithPosition) => {
    return new THREE.Color('#0284c7');
  };

  const scaleFnHighlighted = () => 0.15;
  const scaleFnNormal = () => (isDark ? 0.08 : 0.12);

  // Dim normal stars when there are highlights
  const normalOpacity = highlightedList.length > 0 ? 0.2 : 1.0;

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
        />
      )}

      {edges && edges.length > 0 && (
        <Edges edges={edges} topicMap={topicMap} isDark={isDark} />
      )}

      <CameraAnimation target={nearestTopic} />
    </>
  );
}

export function StarMap({ topics, highlightedTopics, edges }: StarMapProps) {
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
      console.log('[StarMap checkTheme] domIsDark:', domIsDark, 'themeIsDark:', themeIsDark, 'actualIsDark:', actualIsDark, 'setting isDark to:', actualIsDark);
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
