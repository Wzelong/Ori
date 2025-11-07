/**
 * Type definitions for StarMap components
 */
import type * as THREE from 'three';
import type { TopicSearchResult } from '@/services/search';
import type { TopicWithPosition, TopicEdge } from '@/types/schema';
import type { ClusterWithEdges, ClusterInfo } from '@/services/clustering';

export interface StarMapProps {
  graphId: string;
  topics: TopicWithPosition[];
  highlightedTopics?: TopicSearchResult[];
  edges?: TopicEdge[];
  onTopicClick?: (topic: TopicWithPosition) => void;
  showAllLabels?: boolean;
  showClusters?: boolean;
  onClusterCountChange?: (count: number) => void;
}

export interface StarsProps {
  topics: TopicWithPosition[];
  colorFn: (topic: TopicWithPosition) => THREE.Color | number | string;
  scaleFn: (topic: TopicWithPosition) => number;
  isDark: boolean;
  opacity?: number;
  clickable?: boolean;
  onTopicClick?: (topic: TopicWithPosition) => void;
}

export interface EdgesProps {
  edges: TopicEdge[];
  topicMap: Map<string, TopicWithPosition>;
  centerNodeId: string | null;
  isDark: boolean;
  animationKey: string;
  clustersWithEdges?: ClusterWithEdges[];
  edgeDirections?: Map<string, { from: string; to: string }>;
}

export interface EdgeAnimationData {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  delay: number;
  reversed: boolean;
  progress: number;
  point1: THREE.Vector3;
  point2: THREE.Vector3;
  isClusterEdge: boolean;
}

export interface AnimatedEdgesProps {
  lines: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: string;
    opacity: number;
    delay: number;
    reversed: boolean;
    isClusterEdge: boolean;
  }>;
}

export interface LabelsProps {
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

export interface StaticLabelProps {
  topic: TopicWithPosition;
  textColor: string;
  isDark: boolean;
}

export interface AnimatedLabelProps {
  topic: TopicWithPosition;
  textColor: string;
  isDark: boolean;
  delay: number;
}

export interface CameraAnimationProps {
  highlightedTopics: TopicWithPosition[];
  allTopics: TopicWithPosition[];
  onCameraUpdate: (position: THREE.Vector3) => void;
}

export interface SceneProps extends StarMapProps {
  isDark: boolean;
}

export interface SceneInternalProps extends SceneProps {
  clusters: ClusterInfo[];
  allEdgesForMST: TopicEdge[];
}
