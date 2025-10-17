export default function App() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-3xl font-bold text-foreground">Trace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your personal knowledge graph
          </p>
        </header>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search or ask questions..."
              className="flex-1 px-4 py-2 border rounded-md bg-background text-foreground"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <div className="text-sm text-muted-foreground">

            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Knowledge Graph</h2>
            <div className="text-sm text-muted-foreground">

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
