export default function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b pb-4">
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Trace preferences
          </p>
        </header>

        <div className="space-y-6">
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
