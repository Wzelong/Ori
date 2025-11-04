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
    minClusterSize: 2,
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

const SETTINGS_KEY = 'app_settings';

export async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  if (result[SETTINGS_KEY]) {
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
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
