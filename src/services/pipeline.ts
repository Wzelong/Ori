import { extractPageResult } from './extract';
import { insertPageResult } from './insert';
import { db } from '../db/database';
import { isUrlExcluded } from '../lib/urlExclusions';

async function getActiveTabUrl(): Promise<string> {
  const isExtensionPage = typeof window !== 'undefined' &&
    window.location.href.startsWith('chrome-extension://');

  if (isExtensionPage && typeof chrome !== 'undefined' && chrome.tabs) {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('chrome://')) {
        return tab.url;
      }
    }
    throw new Error('No valid web page tab found');
  }

  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    return window.location.href;
  }

  throw new Error('Cannot determine current URL');
}

export async function runPipeline(): Promise<boolean> {
  const currentUrl = await getActiveTabUrl();

  const exclusionCheck = await isUrlExcluded(currentUrl);
  if (exclusionCheck.excluded) {
    return false;
  }

  const existing = await db.items.where('link').equals(currentUrl).first();
  if (existing) {
    return false;
  }

  const pageResult = await extractPageResult();

  await insertPageResult(pageResult);

  return true;
}
