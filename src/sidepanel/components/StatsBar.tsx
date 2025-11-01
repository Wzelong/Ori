import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BookMarked, Sparkle, Waypoints } from 'lucide-react'
import { db } from '@/db/database'
import type { StatusState } from '@/hooks/useExtraction'

interface StatsBarProps {
  status: StatusState
}

export function StatsBar({ status }: StatsBarProps) {
  const [stats, setStats] = useState({ topicCount: 0, itemCount: 0, edgeCount: 0 })

  useEffect(() => {
    const loadStats = async () => {
      const [topicCount, itemCount, edgeCount] = await Promise.all([
        db.topics.count(),
        db.items.count(),
        db.topic_edges.count(),
      ])
      setStats({ topicCount, itemCount, edgeCount })
    }

    loadStats()
    const interval = setInterval(loadStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = () => {
    if (status.type === 'error') return 'bg-red-500'
    if (status.type === 'loading') return 'bg-yellow-500 animate-pulse'
    if (status.type === 'skipped') return 'bg-gray-400'
    return 'bg-green-500'
  }

  const getShortMessage = () => {
    if (status.type === 'skipped') return 'Skipped'
    return status.message
  }

  return (
    <TooltipProvider>
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          {/* Status on left */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full transition-all duration-300 ${getStatusColor()}`} />
            <span className="text-xs text-muted-foreground truncate">
              {getShortMessage()}
            </span>
          </div>

          {/* Stats badges on right */}
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-5 px-2 text-xs font-normal flex items-center gap-1 cursor-default">
                  <BookMarked className="h-3 w-3" />
                  {stats.itemCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Items</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-5 px-2 text-xs font-normal flex items-center gap-1 cursor-default">
                  <Sparkle className="h-3 w-3" />
                  {stats.topicCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Topics</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-5 px-2 text-xs font-normal flex items-center gap-1 cursor-default">
                  <Waypoints className="h-3 w-3" />
                  {stats.edgeCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edges</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
