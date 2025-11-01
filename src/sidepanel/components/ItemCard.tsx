import { useState, useRef, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import type { Item, TopicWithPosition } from '@/types/schema'

interface ItemCardProps {
  topic: TopicWithPosition
  items: Item[]
  onClose: () => void
}

export function ItemCard({ topic, items, onClose }: ItemCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [_isSummaryClipped, setIsSummaryClipped] = useState(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)

  const minSwipeDistance = 50

  useEffect(() => {
    // Reset expansion when item changes
    setSummaryExpanded(false)

    const checkClipping = () => {
      if (summaryRef.current) {
        const element = summaryRef.current
        const clipped = element.scrollHeight > element.clientHeight
        setIsSummaryClipped(clipped)
      }
    }

    checkClipping()
    const timer1 = setTimeout(checkClipping, 50)
    const timer2 = setTimeout(checkClipping, 200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [currentIndex, items])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (items.length === 0) {
    return (
      <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-300 relative z-50">
        <div className="relative border-[1.5px] border-foreground/20 rounded-2xl p-4 bg-background/70 backdrop-blur-md">
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-semibold flex-1">{topic.label}</h3>
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center hover:bg-muted/60 rounded-md transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">No items found for this topic</p>
        </div>
      </div>
    )
  }

  const currentItem = items[currentIndex]

  return (
    <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-300 relative z-50">
      <div className="relative border-[1.5px] border-foreground/20 rounded-2xl bg-background/70 backdrop-blur-md">
        <div className="flex items-start gap-2 p-3 border-b border-foreground/10">
          <h3 className="text-sm font-semibold flex-1">{topic.label}</h3>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center hover:bg-muted/60 rounded-md transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-4">
          <div
            className="select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-start gap-1.5 mb-2">
              <h3 className="text-sm font-semibold line-clamp-2">{currentItem.title}</h3>
              <a
                href={currentItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-muted-foreground transition-colors cursor-pointer flex-shrink-0 mt-[2.5px]"
                title={currentItem.link}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div>
              <div
                ref={summaryRef}
                className="text-xs text-muted-foreground"
              >
                {currentItem.summary.split('\n').map((line, i) => {
                  const trimmed = line.trim()
                  if (trimmed.startsWith('* ')) {
                    const allBullets = currentItem.summary.split('\n').filter(l => l.trim().startsWith('* '))
                    const bulletIndex = allBullets.findIndex(b => b.trim() === trimmed)

                    if (!summaryExpanded && bulletIndex > 0) {
                      return null
                    }

                    return (
                      <div key={i} className="flex gap-1.5 mb-1">
                        <span className="flex-shrink-0">•</span>
                        <span className="flex-1">{trimmed.substring(2)}</span>
                      </div>
                    )
                  }
                  return trimmed ? <p key={i} className="mb-1">{trimmed}</p> : null
                })}
              </div>
              {currentItem.summary.split('\n').filter(l => l.trim().startsWith('* ')).length > 1 && (
                <button
                  onClick={() => setSummaryExpanded(!summaryExpanded)}
                  className="text-xs text-foreground/60 cursor-pointer hover:text-foreground transition-colors mt-1 ml-3"
                >
                  {summaryExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        </div>

        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 pb-3 pt-1">
            {items.map((_, index) => {
              const distance = Math.abs(index - currentIndex)
              const isVisible = distance <= 2

              if (!isVisible) return null

              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    index === currentIndex
                      ? 'w-6 bg-foreground'
                      : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
