import { Tensor } from '@huggingface/transformers'

export async function getEmbeddingFromOffscreen(
  text: string,
  format: 'query' | 'doc' = 'query',
  title?: string
): Promise<number[]> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_EMBEDDING',
    text,
    format,
    title,
  })

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to get embedding')
  }

  return response.embedding
}

export async function getEmbeddingsFromOffscreen(
  texts: string[],
  format: 'query' | 'doc' = 'doc'
): Promise<Tensor> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_EMBEDDINGS',
    texts,
    format,
  })

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to get embeddings')
  }

  const embeddings = response.embeddings
  const numTexts = embeddings.length
  const embeddingDim = embeddings[0].length

  return new Tensor('float32', embeddings.flat(), [numTexts, embeddingDim])
}

export async function warmupModel(): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: 'WARMUP_MODEL',
  })

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to warmup model')
  }
}

export async function checkAIAvailability(): Promise<{ success: boolean; error?: string }> {
  const response = await chrome.runtime.sendMessage({
    type: 'CHECK_AI_AVAILABILITY',
  })

  return response || { success: false, error: 'Failed to check AI availability' }
}

export async function computeSimilarityFromOffscreen(embeddings: Tensor): Promise<number[][]> {
  const shape = embeddings.dims as number[]
  const data = embeddings.data as Float32Array

  const response = await chrome.runtime.sendMessage({
    type: 'COMPUTE_SIMILARITY',
    embeddings: Array.from(data),
    shape,
  })

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to compute similarity')
  }

  return response.similarityMatrix
}
