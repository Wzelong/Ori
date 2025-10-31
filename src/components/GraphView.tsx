import { useState, useRef, useEffect } from 'react';
import type { GraphLayout, GraphData } from '../services/graph';
import type { Item } from '../types/schema';

interface GraphViewProps {
  layout: GraphLayout;
  graphData: GraphData;
}

export default function GraphView({ layout, graphData }: GraphViewProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeWidth = 180;
  const nodeHeight = 60;

  const padding = 100;
  const totalWidth = layout.width + padding * 2;
  const totalHeight = layout.height + padding * 2;
  const centerX = totalWidth / 2;
  const centerY = padding;

  const selectedTopic = selectedTopicId
    ? layout.nodes.find(n => n.topic.id === selectedTopicId)?.topic
    : null;
  const selectedItems = selectedTopicId
    ? graphData.itemsByTopic.get(selectedTopicId) || []
    : [];

  const getTopicLabel = (topicId: string): string => {
    return layout.nodes.find(n => n.topic.id === topicId)?.topic.label || 'Unknown';
  };

  const broaderThanEdges = layout.edges.filter(e => e.type === 'broader_than');
  const relatedToEdges = layout.edges.filter(e => e.type === 'related_to');

  const handleNodeClick = (topicId: string) => {
    if (!hasDragged) {
      setSelectedTopicId(selectedTopicId === topicId ? null : topicId);
    }
  };

  const handleZoomIn = () => {
    setViewBox(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }));
  };

  const handleZoomOut = () => {
    setViewBox(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.3) }));
  };

  const handleReset = () => {
    setViewBox({ x: 0, y: 0, zoom: 1 });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setHasDragged(false);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setHasDragged(true);
      const dx = (e.clientX - dragStart.x) / viewBox.zoom;
      const dy = (e.clientY - dragStart.y) / viewBox.zoom;

      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewBox(prev => ({
        ...prev,
        zoom: Math.max(0.3, Math.min(3, prev.zoom * delta))
      }));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    console.log('[GraphView] Rendering graph');
    console.log('[GraphView] Nodes:', layout.nodes.length);
    console.log('[GraphView] Edges:', layout.edges.length);
    console.log('[GraphView] broader_than:', broaderThanEdges.length);
    console.log('[GraphView] related_to:', relatedToEdges.length);

    layout.edges.forEach((edge, i) => {
      const srcLabel = getTopicLabel(edge.src);
      const dstLabel = getTopicLabel(edge.dst);
      const symbol = edge.type === 'broader_than' ? '→' : '↔';
      console.log(`[GraphView] Edge ${i + 1}: ${srcLabel} ${symbol} ${dstLabel} (${edge.type})`);
    });
  }, [layout]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative overflow-hidden border rounded-md bg-background">
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${totalWidth / viewBox.zoom} ${totalHeight / viewBox.zoom}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              fill="hsl(var(--border))"
            >
              <polygon points="0 0, 10 3, 0 6" />
            </marker>
          </defs>

          {layout.edges.map((edge) => {
            const sourceNode = layout.nodes.find(n => n.topic.id === edge.src);
            const targetNode = layout.nodes.find(n => n.topic.id === edge.dst);

            if (!sourceNode || !targetNode) return null;

            const x1 = centerX + sourceNode.x;
            const y1 = centerY + sourceNode.y + nodeHeight / 2;
            const x2 = centerX + targetNode.x;
            const y2 = centerY + targetNode.y - nodeHeight / 2;

            const isBroaderThan = edge.type === 'broader_than';

            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isBroaderThan ? 'hsl(var(--border))' : 'hsl(var(--muted-foreground))'}
                strokeWidth={isBroaderThan ? 2 : 1}
                strokeDasharray={isBroaderThan ? undefined : '5,5'}
                opacity={isBroaderThan ? 1 : 0.5}
                markerEnd={isBroaderThan ? 'url(#arrowhead)' : undefined}
              />
            );
          })}

          {layout.nodes.map((node) => {
            const x = centerX + node.x - nodeWidth / 2;
            const y = centerY + node.y - nodeHeight / 2;
            const items = graphData.itemsByTopic.get(node.topic.id) || [];
            const isSelected = selectedTopicId === node.topic.id;

            return (
              <g
                key={node.topic.id}
                onClick={() => handleNodeClick(node.topic.id)}
                className="cursor-pointer"
              >
                <title>
                  {node.topic.label}
                  {'\n'}ID: {node.topic.id}
                  {'\n'}Items: {items.length}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={6}
                  fill={isSelected ? 'hsl(var(--accent))' : 'hsl(var(--card))'}
                  stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-all"
                />
                <text
                  x={centerX + node.x}
                  y={centerY + node.y - 8}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="500"
                  fill="hsl(var(--foreground))"
                  className="pointer-events-none select-none"
                >
                  {node.topic.label.length > 20
                    ? node.topic.label.slice(0, 20) + '...'
                    : node.topic.label}
                </text>
                <text
                  x={centerX + node.x}
                  y={centerY + node.y + 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="hsl(var(--muted-foreground))"
                  className="pointer-events-none select-none"
                >
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 text-xs bg-background border rounded hover:bg-accent"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 text-xs bg-background border rounded hover:bg-accent"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs bg-background border rounded hover:bg-accent"
          >
            Reset
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 text-xs bg-background border rounded hover:bg-accent"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>
      </div>

      {selectedTopic && (
        <div className="mt-4 p-4 border rounded-md bg-card">
          <h3 className="font-medium text-sm mb-2">{selectedTopic.label}</h3>
          {selectedItems.length > 0 ? (
            <div className="space-y-1">
              {selectedItems.map((item: Item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.title}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No items</p>
          )}
        </div>
      )}

      {showDebug && (
        <div className="mt-4 p-4 border rounded-md bg-card">
          <h3 className="font-medium text-sm mb-3">Debug Info</h3>

          <div className="space-y-3">
            <div className="flex gap-4 text-xs">
              <span className="text-muted-foreground">
                Nodes: <span className="text-foreground font-medium">{layout.nodes.length}</span>
              </span>
              <span className="text-muted-foreground">
                Edges: <span className="text-foreground font-medium">{layout.edges.length}</span>
              </span>
              <span className="text-muted-foreground">
                broader_than: <span className="text-foreground font-medium">{broaderThanEdges.length}</span>
              </span>
              <span className="text-muted-foreground">
                related_to: <span className="text-foreground font-medium">{relatedToEdges.length}</span>
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Edges:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {broaderThanEdges.map((edge, i) => (
                  <div key={edge.id} className="text-xs font-mono">
                    <span className="text-muted-foreground">{i + 1}.</span>{' '}
                    <span className="text-foreground">{getTopicLabel(edge.src)}</span>{' '}
                    <span className="text-primary">→</span>{' '}
                    <span className="text-foreground">{getTopicLabel(edge.dst)}</span>{' '}
                    <span className="text-muted-foreground">
                      (broader_than, {edge.similarity.toFixed(3)})
                    </span>
                  </div>
                ))}
                {relatedToEdges.map((edge, i) => (
                  <div key={edge.id} className="text-xs font-mono">
                    <span className="text-muted-foreground">{broaderThanEdges.length + i + 1}.</span>{' '}
                    <span className="text-foreground">{getTopicLabel(edge.src)}</span>{' '}
                    <span className="text-muted-foreground">↔</span>{' '}
                    <span className="text-foreground">{getTopicLabel(edge.dst)}</span>{' '}
                    <span className="text-muted-foreground">
                      (related_to, {edge.similarity.toFixed(3)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
