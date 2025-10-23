import { useState } from 'react';
import { processPage } from '../process/pipeline';
import { Button } from '@/components/ui/button';
import type { ProcessedPage } from '../types';

export default function App() {
  const [result, setResult] = useState<ProcessedPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleProcess = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const processed = await processPage();
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-4">
        <Button onClick={handleProcess} disabled={loading} variant="outline">
          {loading ? 'Processing...' : 'Process'}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {result && (
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">{result.title}</h3>
              <a href={result.link} className="text-xs text-muted-foreground hover:underline" target="_blank" rel="noopener noreferrer">
                {result.link}
              </a>
            </div>

            <div className="p-4 border rounded-md bg-muted/20">
              <p className="text-sm text-foreground whitespace-pre-wrap">{result.summary}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Topics:</p>
              <div className="flex flex-wrap gap-2">
                {result.topics.map((topic, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
