import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { ThemeSync } from '@/components/ThemeSync'
import '@/styles/globals.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="ori-theme"
      disableTransitionOnChange
      enableColorScheme={false}
    >
      <ThemeSync />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
