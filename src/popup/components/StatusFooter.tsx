import type { StatusState } from '@/hooks/useExtraction'

interface StatusFooterProps {
  status: StatusState
}

export function StatusFooter({ status }: StatusFooterProps) {
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
    <div className="mt-auto border-t bg-background">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <div className={`h-2 w-2 rounded-full transition-all duration-300 ${getStatusColor()}`} />
        <span className="text-xs text-muted-foreground truncate">
          {getShortMessage()}
        </span>
      </div>
    </div>
  )
}
