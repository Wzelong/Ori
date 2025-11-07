export interface AppSettings {
  graph: {
    topicMergeThreshold: number;
    edgeMinSimilarity: number;
    maxEdgesPerNode: number;
    clusterResolution: number;
    minClusterSize: number;
    umapMinDist: number;
    umapSpread: number;
  };
  search: {
    topicResultCount: number;
    itemResultCount: number;
    similarityThreshold: number;
    maxEdgesInResults: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  graph: {
    topicMergeThreshold: 0.85,
    edgeMinSimilarity: 0.6,
    maxEdgesPerNode: 5,
    clusterResolution: 1.0,
    minClusterSize: 3,
    umapMinDist: 0.4,
    umapSpread: 2.0,
  },
  search: {
    topicResultCount: 5,
    itemResultCount: 10,
    similarityThreshold: 0.4,
    maxEdgesInResults: 20,
  },
};

const SETTINGS_KEY_PREFIX = 'graph_settings_';

function getSettingsKey(graphId: string): string {
  return `${SETTINGS_KEY_PREFIX}${graphId}`;
}

export async function getSettings(graphId: string): Promise<AppSettings> {
  const key = getSettingsKey(graphId);
  const result = await chrome.storage.sync.get(key);
  if (result[key]) {
    return { ...DEFAULT_SETTINGS, ...result[key] };
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(graphId: string, settings: AppSettings): Promise<void> {
  const key = getSettingsKey(graphId);
  await chrome.storage.sync.set({ [key]: settings });
}

export async function resetSettings(graphId: string): Promise<void> {
  const key = getSettingsKey(graphId);
  await chrome.storage.sync.set({ [key]: DEFAULT_SETTINGS });
}

export type SettingsChangeType = 'graph' | 'umap' | 'search' | 'none';

export function detectChanges(
  oldSettings: AppSettings,
  newSettings: AppSettings
): SettingsChangeType {
  const graphChanged =
    oldSettings.graph.topicMergeThreshold !== newSettings.graph.topicMergeThreshold ||
    oldSettings.graph.edgeMinSimilarity !== newSettings.graph.edgeMinSimilarity ||
    oldSettings.graph.maxEdgesPerNode !== newSettings.graph.maxEdgesPerNode ||
    oldSettings.graph.clusterResolution !== newSettings.graph.clusterResolution ||
    oldSettings.graph.minClusterSize !== newSettings.graph.minClusterSize;

  const umapChanged =
    oldSettings.graph.umapMinDist !== newSettings.graph.umapMinDist ||
    oldSettings.graph.umapSpread !== newSettings.graph.umapSpread;

  const searchChanged =
    oldSettings.search.topicResultCount !== newSettings.search.topicResultCount ||
    oldSettings.search.itemResultCount !== newSettings.search.itemResultCount ||
    oldSettings.search.similarityThreshold !== newSettings.search.similarityThreshold ||
    oldSettings.search.maxEdgesInResults !== newSettings.search.maxEdgesInResults;

  if (graphChanged || umapChanged) return 'graph';
  if (umapChanged) return 'umap';
  if (searchChanged) return 'search';
  return 'none';
}
