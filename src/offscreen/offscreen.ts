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

  if (message.type === 'CHECK_AI_AVAILABILITY') {
    (async () => {
      try {
        const checks: string[] = []

        // Check LanguageModel API
        if (!(self as any).LanguageModel) {
          checks.push('LanguageModel API not available. Enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input')
        } else {
          const lmAvailability = await (self as any).LanguageModel.availability()
          if (lmAvailability === 'unavailable') {
            checks.push('Language model unavailable')
          } else if (lmAvailability === 'downloading') {
            checks.push('Language model downloading (~1-2 GB)')
          } else if (lmAvailability === 'downloadable') {
            checks.push('Language model ready to download. Click Extract to start.')
          }
        }

        // Check Summarizer API
        if (!(self as any).Summarizer) {
          checks.push('Summarizer API not available. Enable chrome://flags/#summarization-api-for-gemini-nano')
        } else {
          const sumAvailability = await (self as any).Summarizer.availability()
          if (sumAvailability === 'unavailable') {
            checks.push('Summarizer unavailable')
          } else if (sumAvailability === 'downloading') {
            checks.push('Summarizer downloading')
          } else if (sumAvailability === 'downloadable') {
            checks.push('Summarizer ready to download. Click Extract to start.')
          }
        }

        if (checks.length > 0) {
          sendResponse({ success: false, error: checks.join(' | ') })
        } else {
          sendResponse({ success: true })
        }
      } catch (error) {
        console.error('[Offscreen] AI availability check failed:', error)
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    })()
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
