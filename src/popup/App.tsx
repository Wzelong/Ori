import { ExtractControl } from './components/ExtractControl'
import { GraphStats } from './components/GraphStats'
import { StatusFooter } from './components/StatusFooter'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useExtraction } from '@/hooks/useExtraction'

export default function App() {
  const extraction = useExtraction()

  return (
    <div className="w-96 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Ori" className="h-6 w-6 dark:hidden" />
          <img src="/logoDark.png" alt="Ori" className="h-6 w-6 hidden dark:block" />
          <h1 className="text-lg font-semibold">Ori</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <ExtractControl extraction={extraction} />
        </div>
      </header>

      <div className="p-4">
        <GraphStats />
      </div>

      <StatusFooter status={extraction.status} />
    </div>
  )
}
