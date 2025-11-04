import { getEmbedding, getEmbeddings } from '../llm/embeddings'
import { computeSimilarity } from '../services/vectorUtils'
import { Tensor } from '@huggingface/transformers'


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_EMBEDDING') {
    getEmbedding(message.text, message.format, message.title)
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
    getEmbeddings(message.texts, message.format)
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
    getEmbedding('warmup', 'query')
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('[Offscreen] warmup failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'COMPUTE_SIMILARITY') {
    const tensor = new Tensor('float32', new Float32Array(message.embeddings), message.shape)
    computeSimilarity(tensor)
      .then((similarityMatrix) => {
        sendResponse({ success: true, similarityMatrix })
      })
      .catch((error) => {
        console.error('[Offscreen] computeSimilarity failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})
