import { useState, useEffect } from 'react';
import { runPipeline } from '../services/pipeline';
import { getEmbedding } from '../llm/embeddings';
import { clearDatabase } from '../db/database';
import { Button } from '@/components/ui/button';
import type { PageResult } from '../types/schema';

export default function App() {
  const [modelLoading, setModelLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PageResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getEmbedding('warmup')
      .then(() => setModelLoading(false))
      .catch((err) => {
        setError(err.message);
        setModelLoading(false);
      });
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    setResult(null);

    try {
      const pageResult = await runPipeline();
      setResult(pageResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleClearDB = async () => {
    if (!confirm('Clear entire database? This cannot be undone.')) return;

    try {
      await clearDatabase();
      setResult(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear database');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-4">
        {modelLoading && (
          <p className="text-xs text-muted-foreground">Loading model...</p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleProcess} disabled={modelLoading || processing} variant="outline">
            {processing ? 'Processing...' : 'Process'}
          </Button>
          <Button onClick={handleClearDB} disabled={processing} variant="outline">
            Clear DB
          </Button>
        </div>

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

            {result.topicEmbeddings && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Topic Embeddings:</p>
                <div className="space-y-2">
                  {result.topics.map((topic, i) => (
                    <div key={i} className="p-3 border rounded-md bg-muted/20">
                      <p className="text-xs font-medium mb-1">{topic}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        [{result.topicEmbeddings![i].slice(0, 5).map(v => v.toFixed(3)).join(', ')}, ...] ({result.topicEmbeddings![i].length}d)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.contentEmbedding && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Content Embedding:</p>
                <div className="p-3 border rounded-md bg-muted/20">
                  <p className="text-xs text-muted-foreground font-mono">
                    [{result.contentEmbedding.slice(0, 5).map(v => v.toFixed(3)).join(', ')}, ...] ({result.contentEmbedding.length}d)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
