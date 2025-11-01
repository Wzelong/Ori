const DEFAULT_EXCLUSIONS = [
  'chrome://*',
  'chrome-extension://*',
  'about:*',
  'edge://*',
  'file://*',
  '*://*/login*',
  '*://*/signin*',
  '*://*/auth*',
  '*://*/oauth*',
  '*://*/api/*',
  '*://*/admin/*',
  '*://accounts.google.com/*',
  '*://login.*.com/*',
  '*://auth.*.com/*',
  '*://signin.*.com/*',
  '*://www.google.com/search*',
  '*://www.google.*/search*',
  '*://www.bing.com/search*',
  '*://search.yahoo.com/*',
  '*://duckduckgo.com/*',
  '*://scholar.google.com/scholar*',
  '*://www.baidu.com/s*',
  '*://yandex.com/search*',
  '*://www.reddit.com/search*',
  '*://twitter.com/search*',
  '*://x.com/search*',
  '*://github.com/search*',
  '*://stackoverflow.com/search*',
  '*://www.youtube.com/results*',
  '*://www.amazon.com/s/*',
  '*://www.ebay.com/sch/*',
];

export function getDefaultExclusions(): string[] {
  return [...DEFAULT_EXCLUSIONS];
}

export async function getExclusionPatterns(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['urlExclusions'], (result) => {
      resolve(result.urlExclusions || DEFAULT_EXCLUSIONS);
    });
  });
}

export async function setExclusionPatterns(patterns: string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ urlExclusions: patterns }, () => {
      resolve();
    });
  });
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${escaped}$`, 'i');
}

export async function isUrlExcluded(url: string): Promise<{ excluded: boolean; reason?: string }> {
  try {
    const patterns = await getExclusionPatterns();

    for (const pattern of patterns) {
      const regex = patternToRegex(pattern);
      if (regex.test(url)) {
        return { excluded: true, reason: pattern };
      }
    }

    return { excluded: false };
  } catch (error) {
    console.error('[urlExclusions] Error checking URL:', error);
    return { excluded: false };
  }
}
