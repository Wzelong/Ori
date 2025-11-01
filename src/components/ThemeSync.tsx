import { useEffect } from 'react'
import { useTheme } from 'next-themes'

export function ThemeSync() {
  const { setTheme } = useTheme()

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ori-theme' && e.newValue) {
        setTheme(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [setTheme])

  return null
}
