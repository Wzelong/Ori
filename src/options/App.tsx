import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getExclusionPatterns, setExclusionPatterns, getDefaultExclusions } from '@/lib/urlExclusions'

export default function App() {
  const [patterns, setPatterns] = useState<string[]>([])
  const [newPattern, setNewPattern] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadPatterns()
  }, [])

  const loadPatterns = async () => {
    const loaded = await getExclusionPatterns()
    setPatterns(loaded)
  }

  const handleAddPattern = () => {
    if (newPattern.trim() && !patterns.includes(newPattern.trim())) {
      setPatterns([...patterns, newPattern.trim()])
      setNewPattern('')
    }
  }

  const handleRemovePattern = (index: number) => {
    setPatterns(patterns.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    await setExclusionPatterns(patterns)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    const defaults = getDefaultExclusions()
    setPatterns(defaults)
    await setExclusionPatterns(defaults)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b pb-4">
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Ori preferences
          </p>
        </header>

        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">URL Exclusions</h2>
            <p className="text-sm text-muted-foreground">
              URLs matching these patterns will not be extracted. Use * as wildcard.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
                  placeholder="e.g., *://example.com/*"
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                />
                <Button onClick={handleAddPattern} variant="outline" size="sm">
                  Add
                </Button>
              </div>

              <div className="border rounded-md p-4 space-y-2 max-h-96 overflow-y-auto">
                {patterns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No exclusion patterns</p>
                ) : (
                  patterns.map((pattern, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 border rounded hover:bg-accent/50">
                      <code className="text-xs flex-1">{pattern}</code>
                      <Button
                        onClick={() => handleRemovePattern(index)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} variant="default">
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Reset to Defaults
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 border-l-2 pl-3 mt-4">
                <p className="font-medium">Pattern Examples:</p>
                <p><code>chrome://*</code> - All chrome internal pages</p>
                <p><code>*://*/login*</code> - Any URL containing "login"</p>
                <p><code>*://example.com/*</code> - All pages on example.com</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Data Management</h2>
            <div className="space-y-2">

            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">AI Settings</h2>
            <div className="space-y-2">

            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Privacy</h2>
            <div className="space-y-2">

            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
