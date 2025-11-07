import { extractPageResultFromData } from '../services/extract'
import { insertPageResult } from '../services/insert'
import { isUrlExcluded } from '../lib/urlExclusions'
import { db } from '../db/database'
import { getCurrentGraphId, initializeGraphs } from '../services/graphManager'
import { EXTRACTION } from '../config/constants'

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

  await initializeGraphs()

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

const DEBOUNCE_DELAY = EXTRACTION.AUTO_EXTRACT_DEBOUNCE_MS
const DUPLICATE_WINDOW = EXTRACTION.DUPLICATE_DETECTION_WINDOW_MS

const extractionHistory = new Map<number, { url: string; timestamp: number }>()

async function isContentScriptReady(tabId: number, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' })
      return true
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
  return false
}

async function triggerExtraction() {
  let messageStarted = false
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })

    const tab = tabs[0]

    if (!tab?.id || !tab.url) {
      return
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return
    }


    const lastExtraction = extractionHistory.get(tab.id)
    if (lastExtraction?.url === tab.url && Date.now() - lastExtraction.timestamp < DUPLICATE_WINDOW) {
      return
    }

    await ensureOffscreenDocument()

    const ready = await isContentScriptReady(tab.id)
    if (!ready) {
      console.warn('[Background] Content script not ready, skipping extraction')
      return
    }

    messageStarted = true
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' })

    if (response?.success) {
      extractionHistory.set(tab.id, { url: tab.url, timestamp: Date.now() })
    }
  } catch (error) {
    console.error('[Background] Auto-extraction failed:', error)
    if (messageStarted) {
    }
  }
}

let debounceTimer: NodeJS.Timeout | null = null

async function handleTabUpdate() {
  const { autoExtract, extractionStatus } = await chrome.storage.local.get(['autoExtract', 'extractionStatus'])


  if (!autoExtract) {
    return
  }

  if (extractionStatus === 'extracting') {
    return
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    triggerExtraction()
    debounceTimer = null
  }, DEBOUNCE_DELAY)
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate()
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab.url && tab.status === 'complete') {
    handleTabUpdate()
  }
})

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    handleTabUpdate()
  }
})

let extractionTimeout: NodeJS.Timeout | null = null

const resetExtractionStatus = () => {
  if (extractionTimeout) {
    clearTimeout(extractionTimeout)
    extractionTimeout = null
  }
  chrome.storage.local.set({ extractionStatus: 'idle' })
}

const setExtractionStatus = () => {
  if (extractionTimeout) {
    clearTimeout(extractionTimeout)
  }
  chrome.storage.local.set({ extractionStatus: 'extracting' })

  extractionTimeout = setTimeout(() => {
    console.warn('[Background] Extraction timeout - forcing reset after 30s')
    resetExtractionStatus()
  }, 30000)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PROCESS_EXTRACTION') {
    setExtractionStatus()

    ;(async () => {
      try {
        const url = message.pageData.url

        const exclusionCheck = await isUrlExcluded(url)
        if (exclusionCheck.excluded) {
          resetExtractionStatus()
          sendResponse({ success: false, error: `URL excluded: ${exclusionCheck.reason}` })
          return
        }

        const graphId = await getCurrentGraphId()
        if (!graphId) {
          resetExtractionStatus()
          sendResponse({ success: false, error: 'No active graph selected' })
          return
        }

        const existing = await db.items.where({ graphId, link: url }).first()
        if (existing) {
          resetExtractionStatus()
          sendResponse({ success: false, error: 'Page already extracted' })
          return
        }

        const pageResult = await extractPageResultFromData(message.pageData)
        const item = await insertPageResult(graphId, pageResult)
        resetExtractionStatus()
        sendResponse({ success: true, itemId: item?.id })
      } catch (error) {
        console.error('[Background] Extraction processing failed:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        resetExtractionStatus()
        sendResponse({ success: false, error: errorMessage })
      }
    })()

    return true
  }
})
