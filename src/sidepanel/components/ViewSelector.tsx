import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Telescope, Microscope } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewSelectorProps {
  value: 'explore' | 'inspect'
  onValueChange: (value: 'explore' | 'inspect') => void
}

export function ViewSelector({ value, onValueChange }: ViewSelectorProps) {
  return (
    <TooltipProvider>
      <div className="inline-flex items-center rounded-md border border-input">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange('explore')}
              className={cn(
                'h-8 w-8 p-0 rounded-r-none border-r cursor-pointer',
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
                'h-8 w-8 p-0 rounded-l-none cursor-pointer',
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
      </div>
    </TooltipProvider>
  )
}
