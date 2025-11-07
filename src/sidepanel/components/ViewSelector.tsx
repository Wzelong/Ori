import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Map, Telescope, Microscope, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGraph } from '@/services/graphManager'
import type { Graph } from '@/types/schema'

interface ViewSelectorProps {
  graphId: string
  value: 'explore' | 'inspect' | 'configure' | 'graphs'
  onValueChange: (value: 'explore' | 'inspect' | 'configure' | 'graphs') => void
}

export function ViewSelector({ graphId, value, onValueChange }: ViewSelectorProps) {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (graphId) {
      setLoading(true)
      getGraph(graphId).then(g => {
        setGraph(g || null)
        setLoading(false)
      })
    }
  }, [graphId])

  const graphName = loading ? 'Loading...' : (graph?.name || graphId)

  return (
    <TooltipProvider>
      <div className="inline-flex items-center rounded-md border border-input">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange('graphs')}
              className={cn(
                "h-8 px-3 gap-2 rounded-r-none border-r max-w-32 cursor-pointer",
                value === 'graphs' && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Map className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-xs">{graphName}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Graphs</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange('explore')}
              className={cn(
                'h-8 w-8 p-0 rounded-none border-r cursor-pointer',
                value === 'explore' && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-label="Explore view"
            >
              <Telescope className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Explore</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange('inspect')}
              className={cn(
                'h-8 w-8 p-0 rounded-none border-r cursor-pointer',
                value === 'inspect' && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-label="Inspect view"
            >
              <Microscope className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Inspect</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange('configure')}
              className={cn(
                'h-8 w-8 p-0 rounded-l-none cursor-pointer',
                value === 'configure' && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-label="Configure view"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Configure</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
