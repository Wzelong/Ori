// =============================================================================
// OFFSCREEN DOCUMENT - Hosts embedding model in persistent DOM context
// Bypasses Service Worker WASM limitations
// =============================================================================

let offscreenCreating: Promise<void> | null = null

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  })

  if (existingContexts.length > 0) return

  if (offscreenCreating) {
    await offscreenCreating
    return
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: 'Host embedding model to bypass Service Worker WASM limitations',
  })

  await offscreenCreating
  offscreenCreating = null
}

async function initializeExtension() {
  await ensureOffscreenDocument()

  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'WARMUP_MODEL' }).catch(() => {})
  }, 100)

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
}

chrome.runtime.onInstalled.addListener(initializeExtension)
chrome.runtime.onStartup.addListener(initializeExtension)

// =============================================================================
// AUTO-EXTRACTION - Trigger extraction on tab events when enabled
// =============================================================================

const DEBOUNCE_DELAY = 2000
const DUPLICATE_WINDOW = 60000

const extractionHistory = new Map<number, { url: string; timestamp: number }>()
const debounceTimers = new Map<number, NodeJS.Timeout>()

async function shouldExtract(tabId: number, url: string): Promise<boolean> {
  const { autoExtract } = await chrome.storage.local.get(['autoExtract'])
  if (!autoExtract) {
    console.log('[Background] Auto-extract disabled')
    return false
  }

  const lastExtraction = extractionHistory.get(tabId)
  if (lastExtraction?.url === url && Date.now() - lastExtraction.timestamp < DUPLICATE_WINDOW) {
    console.log('[Background] Skipping duplicate extraction:', url)
    return false
  }

  return true
}

async function triggerExtraction(tabId: number, url: string) {
  try {
    console.log('[Background] Triggering auto-extract for:', url)
    await ensureOffscreenDocument()
    await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' })
    extractionHistory.set(tabId, { url, timestamp: Date.now() })
  } catch (error) {
    console.error('[Background] Auto-extraction failed:', error)
  }
}

async function handleTabUpdate(tabId: number, url: string) {
  console.log('[Background] Tab update detected:', url)
  if (!await shouldExtract(tabId, url)) return

  if (debounceTimers.has(tabId)) {
    clearTimeout(debounceTimers.get(tabId)!)
  }

  const timer = setTimeout(() => {
    triggerExtraction(tabId, url)
    debounceTimers.delete(tabId)
  }, DEBOUNCE_DELAY)

  debounceTimers.set(tabId, timer)
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate(tabId, tab.url)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab.url && tab.status === 'complete') {
    handleTabUpdate(activeInfo.tabId, tab.url)
  }
})

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    handleTabUpdate(details.tabId, details.url)
  }
})
