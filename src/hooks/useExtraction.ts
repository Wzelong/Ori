import { useState, useEffect } from 'react'
import { runPipeline } from '@/services/pipeline'
import { warmupModel } from '@/llm/offscreenClient'

export type StatusState = {
  type: 'ready' | 'error' | 'loading' | 'skipped'
  message: string
}

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [modelLoading, setModelLoading] = useState(true)
  const [status, setStatus] = useState<StatusState>({ type: 'loading', message: 'Loading model...' })

  useEffect(() => {
    warmupModel()
      .then(() => {
        setModelLoading(false)
        setStatus({ type: 'ready', message: 'Ready' })
      })
      .catch((err) => {
        setModelLoading(false)
        setStatus({ type: 'error', message: err.message })
      })

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.extractionStatus) {
        const status = changes.extractionStatus.newValue
        if (status === 'extracting') {
          setIsExtracting(true)
          setStatus({ type: 'loading', message: 'Extracting...' })
        } else if (status === 'idle' && isExtracting) {
          setIsExtracting(false)
          setStatus({ type: 'ready', message: 'Ready' })
        }
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const handleExtract = async () => {
    setIsExtracting(true)
    try {
      const success = await runPipeline()
      if (!success) {
        setStatus({ type: 'skipped', message: 'Page skipped (duplicate or excluded)' })
        setTimeout(() => setStatus({ type: 'ready', message: 'Ready' }), 3000)
      } else {
        setStatus({ type: 'ready', message: 'Extracted successfully' })
        setTimeout(() => setStatus({ type: 'ready', message: 'Ready' }), 3000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setStatus({ type: 'error', message: errorMsg })
      setTimeout(() => setStatus({ type: 'ready', message: 'Ready' }), 5000)
      console.error('[ExtractControl] Error:', err)
    } finally {
      setIsExtracting(false)
    }
  }

  return { isExtracting, modelLoading, handleExtract, status }
}
