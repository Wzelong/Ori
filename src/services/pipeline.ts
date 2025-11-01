import { extractPageResult } from './extract';
import { insertPageResult } from './insert';
import { db } from '../db/database';
import { isUrlExcluded } from '../lib/urlExclusions';

async function getActiveTabUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url || window.location.href;
  }
  return window.location.href;
}

export async function runPipeline(): Promise<boolean> {
  const currentUrl = await getActiveTabUrl();

  const exclusionCheck = await isUrlExcluded(currentUrl);
  if (exclusionCheck.excluded) {
    console.log('[pipeline] URL excluded:', currentUrl, 'Pattern:', exclusionCheck.reason);
    return false;
  }

  const existing = await db.items.where('link').equals(currentUrl).first();
  if (existing) {
    console.log('[pipeline] Page already extracted, skipping:', currentUrl);
    return false;
  }

  const pageResult = await extractPageResult();
  console.log('[pipeline] Extracted:', pageResult);

  const item = await insertPageResult(pageResult);
  console.log('[pipeline] Inserted item:', item);

  return true;
}
