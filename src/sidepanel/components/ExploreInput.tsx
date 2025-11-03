import { useState, useRef, useEffect } from 'react'
import { CircleChevronUp, Loader2 } from 'lucide-react'

const MAX_HEIGHT = 100

function resize(textarea: HTMLTextAreaElement) {
  textarea.style.boxSizing = 'border-box'
  textarea.style.paddingTop = '0px'
  textarea.style.paddingBottom = '0px'

  textarea.style.height = '0px'

  const next = Math.min(textarea.scrollHeight, MAX_HEIGHT)
  textarea.style.height = `${next}px`

  textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
}

interface ExploreInputProps {
  onSearch: (query: string) => Promise<void>
  onInputChange?: () => void
  isSearching?: boolean
  hasResults?: boolean
}

export function ExploreInput({ onSearch, onInputChange, isSearching = false, hasResults = false }: ExploreInputProps) {
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      resize(textareaRef.current)
    }
  }, [])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isSearching) return
    const query = input.trim()
    setInput('')
    setIsExpanded(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'
      resize(textareaRef.current)
    }
    await onSearch(query)
  }

  return (
    <div
      className={`relative w-full border-[1.5px] ${
        isFocused ? 'border-foreground/60' : 'border-foreground/20'
      } ${
        isExpanded ? 'rounded-2xl' : 'rounded-full'
      } p-3 flex items-center gap-1 bg-background/20 backdrop-blur-md`}
      style={{
        transition: 'border-radius ease-in-out, border-color 0.2s ease-in-out'
      }}
    >
      <textarea
        ref={textareaRef}
        className="p-2 flex-1 max-h-[100px] resize-none border-none focus:outline-none bg-transparent placeholder:text-muted-foreground/60 text-[14px] leading-[20px] overflow-hidden"
        rows={1}
        value={input}
        placeholder="Explore the stars..."
        onChange={(e) => {
          const newValue = e.target.value
          setInput(newValue)

          if (hasResults && onInputChange) {
            onInputChange()
          }
        }}
        onInput={(e) => {
          const ta = e.target as HTMLTextAreaElement
          resize(ta)

          const lh = parseFloat(getComputedStyle(ta).lineHeight || '20')
          const lines = Math.round(ta.scrollHeight / lh)
          setIsExpanded(lines >= 2)
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyPress}
      />

      <button
        className={`flex-shrink-0 self-end -mb-[2px] p-1 transition-opacity ${
          input.trim() !== '' && !isSearching
            ? 'text-foreground cursor-pointer hover:opacity-60'
            : 'text-muted-foreground cursor-not-allowed opacity-40'
        }`}
        onClick={handleSendMessage}
        disabled={!input.trim() || isSearching}
      >
        {isSearching ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : (
          <CircleChevronUp className="h-4.5 w-4.5" />
        )}
      </button>
    </div>
  )
}
