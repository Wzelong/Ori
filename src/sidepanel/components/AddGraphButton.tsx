import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface AddGraphButtonProps {
  className?: string
}

export function AddGraphButton({ className }: AddGraphButtonProps) {
  const handleAdd = () => {
    console.log('Add graph')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${className || ''}`}
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Create new graph</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
