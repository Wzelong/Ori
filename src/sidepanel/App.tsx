import { useState, useEffect, useMemo } from 'react';
import { runPipeline } from '../services/pipeline';
import { getEmbedding } from '../llm/embeddings';
import { clearDatabase } from '../db/database';
import { getGraphData, calculateHierarchicalLayout, type GraphData } from '../services/graph';
import { Button } from '@/components/ui/button';
import GraphView from '../components/GraphView';

export default function App() {
  const [modelLoading, setModelLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string>('');

  const layout = useMemo(() => {
    if (!graphData) return null;
    return calculateHierarchicalLayout(graphData);
  }, [graphData]);

  const loadGraph = async () => {
    try {
      const data = await getGraphData();
      console.log(data);
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    }
  };

  useEffect(() => {
    getEmbedding('warmup')
      .then(() => setModelLoading(false))
      .catch((err) => {
        setError(err.message);
        setModelLoading(false);
      });

    loadGraph();
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    setError('');

    try {
      await runPipeline();
      await loadGraph();
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
      setGraphData(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear database');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4 border-b space-y-2">
        {modelLoading && (
          <p className="text-xs text-muted-foreground">Loading model...</p>
        )}

        <div className="flex gap-2 items-center">
          <Button onClick={handleProcess} disabled={modelLoading || processing} variant="outline">
            {processing ? 'Processing...' : 'Process'}
          </Button>
          <Button onClick={handleClearDB} disabled={processing} variant="outline">
            Clear DB
          </Button>

          {graphData && graphData.topics.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {graphData.topics.length} topics, {graphData.items.length} items
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        {layout && graphData ? (
          <GraphView layout={layout} graphData={graphData} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {graphData ? 'No topics yet. Process a page to start.' : 'Loading...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
