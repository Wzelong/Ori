import { Tensor } from '@huggingface/transformers'

export async function getEmbeddingFromOffscreen(text: string): Promise<number[]> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_EMBEDDING',
    text,
  })

  if (!response.success) {
    throw new Error(response.error || 'Failed to get embedding')
  }

  return response.embedding
}

export async function getEmbeddingsFromOffscreen(texts: string[]): Promise<Tensor> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_EMBEDDINGS',
    texts,
  })

  if (!response.success) {
    throw new Error(response.error || 'Failed to get embeddings')
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

  if (!response.success) {
    throw new Error(response.error || 'Failed to warmup model')
  }
}

export async function computeSimilarityFromOffscreen(embeddings: Tensor): Promise<number[][]> {
  const shape = embeddings.dims as number[]
  const data = embeddings.data as Float32Array

  const response = await chrome.runtime.sendMessage({
    type: 'COMPUTE_SIMILARITY',
    embeddings: Array.from(data),
    shape,
  })

  if (!response.success) {
    throw new Error(response.error || 'Failed to compute similarity')
  }

  return response.similarityMatrix
}
