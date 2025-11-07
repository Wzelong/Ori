import { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { StarsProps } from './types';

/**
 * Instanced mesh component for rendering topic nodes as spheres
 * Uses instancing for efficient rendering of hundreds/thousands of nodes
 */
export function Stars({
  topics,
  colorFn,
  scaleFn,
  isDark,
  opacity = 1,
  clickable = false,
  onTopicClick
}: StarsProps) {
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

  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Precompute per-instance data for performance
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
      tempColor.set(c as any);
      colors[i * 3 + 0] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    return { positions, scales, colors };
  }, [topics, colorFn, scaleFn, count, tempColor]);

  useEffect(() => {
    if (!meshRef.current) return;

    // Update instance matrices and colors
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

    meshRef.current.computeBoundingSphere();
    meshRef.current.computeBoundingBox();
  }, [positions, scales, colors, count, tempObj, tempColor, isDark, clickable, opacity]);

  const handlePointerDown = () => {
    if (clickable) {
      pointerDownTimeRef.current = Date.now();
    }
  };

  const handlePointerUp = (event: any) => {
    if (!clickable || !onTopicClick) return;

    const clickDuration = Date.now() - pointerDownTimeRef.current;
    if (clickDuration > 200) return; // Ignore drags

    const instanceId = event.instanceId;
    if (instanceId !== undefined && instanceId < topics.length) {
      const clickedTopic = topics[instanceId];
      onTopicClick(clickedTopic);
    }
  };

  const handlePointerOver = () => {
    if (clickable) {
      setHovered(true);
    }
  };

  const handlePointerOut = () => {
    if (clickable) {
      setHovered(false);
    }
  };

  if (count === 0) return null;

  return (
    <instancedMesh
      key={`stars-${count}`}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      renderOrder={0}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={(e) => e.stopPropagation()}
    >
      <sphereGeometry args={[1.5, 16, 16]} />
      {isDark ? (
        <meshStandardMaterial
          emissive="#ffffff"
          emissiveIntensity={2.0}
          toneMapped={false}
          transparent={true}
          opacity={opacity}
        />
      ) : (
        <meshBasicMaterial
          transparent={true}
          opacity={opacity}
        />
      )}
    </instancedMesh>
  );
}
