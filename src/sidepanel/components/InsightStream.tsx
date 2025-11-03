import { useEffect, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { X } from 'lucide-react'

interface InsightStreamProps {
  stream: ReadableStream<string> | null
  isWaiting: boolean
  itemMap?: Map<string, string>
  onClose?: () => void
  onComplete?: () => void
}

export function InsightStream({ stream, isWaiting, itemMap, onClose, onComplete }: InsightStreamProps) {
  const [text, setText] = useState('')
  const [dots, setDots] = useState(1)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    if (!stream || stream.locked) {
      if (!stream) setText('')
      return
    }

    setText('')

    const reader = stream.getReader()
    let firstChunk = true

    const readStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            onComplete?.()
            break
          }
          if (firstChunk) {
            firstChunk = false
            onComplete?.()
          }
          setText(prev => prev + value)
        }
      } catch (error) {
        console.error('[InsightStream] Error reading stream:', error)
        onComplete?.()
      }
    }

    readStream()

    return () => {
      reader.cancel()
    }
  }, [stream])

  useEffect(() => {
    if (!isWaiting) return

    const interval = setInterval(() => {
      setDots(prev => (prev % 3) + 1)
    }, 500)

    return () => clearInterval(interval)
  }, [isWaiting])

  const renderText = useMemo(() => {
    if (!text || !itemMap) return text

    const parts: (string | React.ReactElement)[] = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }

      const content = match[1]
      const link = itemMap.get(content)

      if (link) {
        const isPageId = /^p\d+$/.test(content)

        if (isPageId) {
          const citationNumber = content.substring(1)
          parts.push(
            <a
              key={match.index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 hover:text-foreground transition-colors cursor-pointer no-underline"
            >
              <sup>[{citationNumber}]</sup>
            </a>
          )
        } else {
          parts.push(
            <a
              key={match.index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline hover:text-foreground/60 cursor-pointer transition-colors"
            >
              {content}
            </a>
          )
        }
      } else {
        parts.push(`**${content}**`)
      }

      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts
  }, [text, itemMap])

  return (
    <div className="px-4 py-2">
      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0 mt-0.5">
          <img
            src={isDark ? '/logoDark.png' : '/logo.png'}
            alt="Logo"
            className="h-4 w-4"
          />
        </div>
        <div className="flex-1 text-xs text-foreground/80 leading-relaxed font-mono">
          {isWaiting ? '.'.repeat(dots) : renderText}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 h-5 w-5 flex items-center justify-center hover:bg-muted/60 rounded-md transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
