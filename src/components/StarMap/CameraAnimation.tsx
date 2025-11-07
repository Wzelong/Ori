import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraAnimationProps } from './types';

/**
 * Camera animation component that auto-focuses on search results
 * Computes optimal camera position and smoothly transitions
 */
export function CameraAnimation({
  highlightedTopics,
  allTopics,
  onCameraUpdate
}: CameraAnimationProps) {
  const controlsRef = useRef<any>(null);
  const previousTargetRef = useRef<string>('');

  useFrame(({ camera }) => {
    if (onCameraUpdate) {
      onCameraUpdate(camera.position);
    }
  });

  /**
   * Computes bounding box and optimal camera distance for a set of topics
   */
  const computeBounds = useCallback((topics: typeof allTopics) => {
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
      : span * 1.5;

    return { center, distance };
  }, []);

  /**
   * Determines camera target based on highlighted topics
   * - No highlights: show all topics
   * - Single highlight: focus on that topic
   * - Multiple highlights: position camera to view cluster with nearest topic forward
   */
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

    // Multiple highlights - position camera outside cluster looking in
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

    // Prevent redundant animations with same target
    const highlightedIds = highlightedTopics.map(t => t.id).sort().join(',');
    const targetKey = `${highlightedIds}:${allTopics.length}`;

    if (previousTargetRef.current === targetKey) return;
    previousTargetRef.current = targetKey;

    const { center, distance, lookAt } = cameraTarget;

    if (lookAt) {
      // Position camera at 'center' looking at 'lookAt'
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
      // Position camera at distance from center, looking at center
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
  }, [cameraTarget, highlightedTopics, allTopics]);

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
