import { getEmbedding, getEmbeddings } from '../llm/embeddings'

console.log('[Offscreen] Model host initialized')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_EMBEDDING') {
    getEmbedding(message.text)
      .then((embedding) => {
        sendResponse({ success: true, embedding })
      })
      .catch((error) => {
        console.error('[Offscreen] getEmbedding failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'GET_EMBEDDINGS') {
    getEmbeddings(message.texts)
      .then((embeddings) => {
        sendResponse({ success: true, embeddings: embeddings.tolist() })
      })
      .catch((error) => {
        console.error('[Offscreen] getEmbeddings failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'WARMUP_MODEL') {
    getEmbedding('warmup')
      .then(() => {
        console.log('[Offscreen] Model warmed up successfully')
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('[Offscreen] warmup failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})
