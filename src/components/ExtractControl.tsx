import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BookDown, Sparkles } from 'lucide-react'
import { useAutoExtract } from '@/hooks/useAutoExtract'
import { cn } from '@/lib/utils'

interface ExtractControlProps {
  extraction: {
    isExtracting: boolean
    modelLoading: boolean
    handleExtract: () => Promise<void>
  }
  compact?: boolean
}

export function ExtractControl({ extraction }: ExtractControlProps) {
  const [autoExtract, setAutoExtract] = useAutoExtract()
  const { isExtracting, modelLoading, handleExtract } = extraction

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExtract}
              disabled={isExtracting || modelLoading || autoExtract}
              className="h-8 w-8 p-0"
            >
              <BookDown className={cn(
                "h-4 w-4",
                isExtracting && "animate-spin"
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isExtracting ? 'Extracting...' : 'Extract current page'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoExtract(!autoExtract)}
              disabled={modelLoading}
              className={cn(
                "h-8 w-8 p-0 transition-all relative",
                autoExtract && "text-white hover:text-white shadow-sm"
              )}
              style={autoExtract ? { backgroundColor: '#0284c7' } : undefined}
            >
              <Sparkles
                className="h-4 w-4"
                style={autoExtract ? {
                  animation: 'subtle-bounce 0.8s ease-in-out infinite'
                } : undefined}
              />
              <style>{`
                @keyframes subtle-bounce {
                  0%, 100% {
                    transform: translateY(0);
                  }
                  25% {
                    transform: translateY(-0.3px);
                  }
                  75% {
                    transform: translateY(0.3px);
                  }
                }
              `}</style>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Auto-extract on page load</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
