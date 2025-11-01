import { runPipeline } from './services/pipeline'

console.log('[Content] Ori content script loaded')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE') {
    console.log('[Content] Received extraction request')

    chrome.storage.local.set({ extractionStatus: 'extracting' })

    runPipeline()
      .then((success) => {
        console.log('[Content] Extraction completed:', success)
        chrome.storage.local.set({ extractionStatus: 'idle' })
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('[Content] Extraction failed:', error)
        chrome.storage.local.set({ extractionStatus: 'idle' })
        sendResponse({ success: false, error: error.message })
      })

    return true
  }
})
