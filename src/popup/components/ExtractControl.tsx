import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/custom-switch'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BookDown, Sparkles, Loader2 } from 'lucide-react'
import { useAutoExtract } from '@/hooks/useAutoExtract'

interface ExtractControlProps {
  extraction: {
    isExtracting: boolean
    modelLoading: boolean
    handleExtract: () => Promise<void>
  }
  compact?: boolean
}

export function ExtractControl({ extraction, compact = false }: ExtractControlProps) {
  const [autoExtract, setAutoExtract] = useAutoExtract()
  const { isExtracting, modelLoading, handleExtract } = extraction

  const buttonSize = compact ? 'h-8 text-xs px-3' : 'h-9'
  const badgeSize = compact ? 'h-8 text-xs px-2.5' : 'h-9 text-sm px-3'
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {!autoExtract ? (
          <Button
            variant={'outline'}
            onClick={handleExtract}
            disabled={isExtracting || modelLoading}
            size="sm"
            className={`rounded-full gap-1.5 transition-colors hover:bg-[hsl(var(--accent))] ${buttonSize}`}
          >
            {isExtracting ? (
              <>
                <Loader2 className={`${iconSize} animate-spin`} />
                {compact ? 'Extracting...' : 'Extracting...'}
              </>
            ) : (
              <>
                <BookDown className={iconSize} />
                Extract
              </>
            )}
          </Button>
        ) : (
          <Badge variant="outline" className={`flex items-center gap-1.5 select-none pointer-events-none ${badgeSize}`}>
            <Sparkles className={iconSize} />
            Auto On
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch
                id="auto-extract"
                checked={autoExtract}
                onCheckedChange={setAutoExtract}
                disabled={modelLoading}
                className={compact ? 'scale-90' : ''}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Auto-extract on page load</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
