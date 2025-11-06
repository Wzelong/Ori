import { useState, useEffect } from 'react'
import { runPipeline } from '@/services/pipeline'
import { warmupModel, checkAIAvailability } from '@/llm/offscreenClient'

export type StatusState = {
  type: 'ready' | 'error' | 'loading' | 'skipped' | 'success'
  message: string
}

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [modelLoading, setModelLoading] = useState(true)
  const [status, setStatus] = useState<StatusState>({ type: 'loading', message: 'Checking AI models...' })

  useEffect(() => {
    // Check AI model availability first
    checkAIAvailability()
      .then((result) => {
        if (!result.success) {
          setModelLoading(false)
          setStatus({ type: 'error', message: result.error || 'AI models not available' })
          console.error('[ExtractControl] AI availability check failed:', result.error)
          return Promise.reject(new Error(result.error))
        }
        // Then warm up embedding model
        return warmupModel()
      })
      .then(() => {
        setModelLoading(false)
        setStatus({ type: 'ready', message: 'Ready' })
      })
      .catch((err) => {
        setModelLoading(false)
        const message = err.message || 'Model initialization failed'
        setStatus({ type: 'error', message })
        console.error('[ExtractControl] Model initialization error:', err)
      })

    let timeoutId: NodeJS.Timeout | null = null

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.extractionStatus) {
        const status = changes.extractionStatus.newValue
        if (status === 'extracting') {
          setIsExtracting(true)
          setStatus({ type: 'loading', message: 'Extracting...' })

          if (timeoutId) clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            console.error('[ExtractControl] Extraction timeout - forcing reset')
            setIsExtracting(false)
            setStatus({ type: 'error', message: 'Extraction timed out' })
            chrome.storage.local.set({ extractionStatus: 'idle' })
            setTimeout(() => setStatus({ type: 'ready', message: 'Ready' }), 3000)
          }, 60000)
        } else if (status === 'idle') {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          setIsExtracting(false)
          setStatus({ type: 'ready', message: 'Ready' })
        }
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const handleExtract = async () => {
    const { extractionStatus } = await chrome.storage.local.get(['extractionStatus'])
    if (extractionStatus === 'extracting') {
      return
    }

    setIsExtracting(true)
    setStatus({ type: 'loading', message: 'Extracting...' })
    chrome.storage.local.set({ extractionStatus: 'extracting' })

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
      console.error('[ExtractControl] Error:', err)

      // For model-related errors, show the error longer
      const timeout = errorMsg.includes('downloading') || errorMsg.includes('unavailable') ? 10000 : 5000
      setTimeout(() => setStatus({ type: 'ready', message: 'Ready' }), timeout)
    } finally {
      setIsExtracting(false)
      chrome.storage.local.set({ extractionStatus: 'idle' })
    }
  }

  return { isExtracting, modelLoading, handleExtract, status }
}
