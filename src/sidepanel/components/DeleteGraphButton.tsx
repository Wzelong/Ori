import { Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DeleteGraphButtonProps {
  className?: string
}

export function DeleteGraphButton({ className }: DeleteGraphButtonProps) {
  const handleDelete = () => {
    console.log('Delete graph')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${className || ''}`}
            onClick={handleDelete}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Delete current graph</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
