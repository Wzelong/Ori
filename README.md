# Ori

A Chrome extension that transforms browsing history into an interactive 3D semantic knowledge graph using on-device AI.

## Overview

Ori automatically constructs a living knowledge graph from your browsing activity. It extracts content, generates embeddings, discovers semantic relationships, and visualizes connections in 3D space—all while operating entirely offline with Chrome's built-in AI.

**Key Features:**
- **On-device AI**: Zero cloud dependencies using Chrome's Gemini Nano
- **Automatic graph construction**: No manual tagging required
- **Semantic organization**: Content grouped by meaning, not keywords
- **3D visualization**: Interactive StarMap with cluster detection
- **RAG-powered insights**: Conversational interface over your browsing history
- **Configurable parameters**: Fine-tune graph behavior via settings UI

## Installation

### Prerequisites

**System Requirements:**
- **Chrome:** Version 127+ (stable channel)
- **OS:** Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook Plus)
- **Storage:** 22 GB free space on Chrome profile drive
- **Hardware:** GPU with 4+ GB VRAM OR CPU with 16+ GB RAM and 4+ cores
- **Network:** Unmetered connection (Wi-Fi recommended for model download)

**Enable Built-in AI:**

1. Open Chrome and navigate to:
   ```
   chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
   ```

2. Set to **"Enabled"** and click **"Relaunch"**

3. Verify setup:
   - Go to `chrome://on-device-internals`
   - Check **Model Status** tab (model will auto-download if requirements are met)
   - Open DevTools Console (F12) and run:
     ```javascript
     await ai.languageModel.availability()
     ```
   - Should return: `"available"`

### Build and Load

```bash
git clone https://github.com/yourusername/ori.git
cd ori
npm install
npm run build
```

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` directory

**Note:** Model download may take several minutes on first use. Ensure you have 22+ GB free storage.

## Quick Start

### First-Time Setup

1. **Install the extension** following the steps above
2. **Pin to toolbar**: Click the puzzle icon in Chrome, find "Ori", click the pin
3. **Wait for model download**: First use triggers Gemini Nano download (~1-2 GB, takes a few minutes)

### Using Ori

**Extract Content:**
1. Visit any webpage you want to save
2. Click the Ori extension icon
3. Click **"Extract"** button
4. Wait for processing (AI summarizes and extracts topics)

**Explore Your Graph:**
1. Click the Ori icon again
2. Click **"Open Side Panel"**
3. View your 3D knowledge graph in the **Explore** tab
4. Click nodes to see related pages
5. Use the search box to find topics by meaning

**Search with AI:**
1. Type a natural language query (e.g., "machine learning concepts")
2. Graph highlights relevant topics and zooms to them
3. Read the AI-generated insight summarizing related content
4. Click page references to open original sources

**Manage Content:**
1. Switch to **Inspect** tab in side panel
2. View all topics and pages in table format
3. Use search to filter by keywords
4. Select multiple items and delete if needed
5. Click any row to see details

**Customize Settings:**
1. Switch to **Configure** tab
2. Adjust graph parameters (merge threshold, edge limits, spacing)
3. Tune search settings (result counts, thresholds)
4. Click **Apply** when done (recomputes positions if needed)
5. Click **Reset** to restore defaults

### Tips

- **Extract frequently**: Build your graph by processing pages you visit
- **Use semantic search**: Ask questions naturally, not just keywords
- **Explore connections**: Click nodes and connected topics to discover relationships
- **Toggle cluster view**: Shows communities of related topics with color coding
- **Adjust spacing**: If nodes are too close, increase UMAP spread in Configure

## Features

### Explore View
- **3D StarMap**: Interactive visualization of topics as nodes with edges representing semantic similarity
- **Cluster Visualization**: Louvain community detection with color-coded groups and MST edges
- **Semantic Search**: Natural language queries with automatic camera focus on results
- **RAG Insights**: Streaming contextual summaries with clickable page references
- **Dynamic Controls**: Toggle edges, labels, and cluster modes

### Inspect View
- **Table Interface**: Paginated view of all topics and pages with search and sort
- **Bulk Operations**: Multi-select and delete topics or pages with cascade cleanup
- **Detail Views**: Click to see connected topics, linked pages, and metadata
- **Navigation**: Click connected topics to explore the graph

### Configure View
- **Graph Settings**: Topic merge threshold, edge similarity, max edges per node, cluster parameters, UMAP spacing
- **Search Settings**: Result counts, similarity thresholds, max edges in results
- **Smart Apply**: Automatically recomputes positions when graph/UMAP parameters change
- **Reset**: Restore all settings to defaults

## Architecture

### Pipeline

```
Content Extraction → Validation → Extraction → Embedding
                                                    ↓
                                            Graph Construction
                                                    ↓
                                    Dimensionality Reduction (PCA → UMAP)
                                                    ↓
                                              3D Visualization
```

### Database Schema

**IndexedDB via Dexie:**
- `topics`: id, label (unique), uses, createdAt, x/y/z coordinates
- `items`: id, title, summary, link (unique), createdAt
- `item_topic`: Many-to-many junction table
- `topic_edges`: id, src, dst, similarity, createdAt (unique composite index on [src+dst])
- `vectors`: ownerType, ownerId, buf (768-dim ArrayBuffer), createdAt

### Vector Embeddings

**Model:** `onnx-community/embeddinggemma-300m-ONNX`
- **Dimensions:** 768
- **Format:**
  - Query: `"task: search result | query: {text}"`
  - Document: `"title: {title} | text: {text}"`
- **Storage:** Float32Array serialized to ArrayBuffer in IndexedDB
- **Hosting:** Offscreen document (bypasses service worker WASM limitations)

### Dimensionality Reduction

**PCA:** 768D → 100D (custom implementation)
**UMAP:** 100D → 3D
- nNeighbors: min(15, floor(topics / 2))
- minDist: 0.4 (configurable)
- spread: 2.0 (configurable)
- Normalized to [-20, 20] coordinate space

### Graph Construction

**Topic Extraction:**
- Uses Gemini Nano with JSON schema constraint
- Extracts 2-4 topics per page (first = core concept, rest = related)
- Generates 768-dim embeddings for each topic

**Topic Merging:**
- Computes similarity matrix against all existing topics
- Merges topics above threshold (default: 0.85, configurable)
- Exact label match takes precedence

**Edge Creation:**
- Creates edges between topics with similarity ≥ 0.6 (configurable)
- Enforces max 5 edges per node (configurable), bidirectionally
- Sorts neighbors by similarity and keeps strongest connections
- Prevents duplicate edges via sorted [src, dst] composite index

**Edge Pruning:**
- Checks both new topic AND target neighbor edge counts
- Skips neighbors already at max capacity
- Maintains graph density while respecting limits

### Cluster Detection

**Louvain Algorithm:** via graphology-communities-louvain
- Resolution: 1.0 (configurable)
- Min cluster size: 2 (configurable)
- Semantic medoid selection using embeddings (topic closest to cluster centroid)
- MST computation for tree visualization within clusters
- Depth tracking and direction mapping for animated edge growth

### RAG Search

1. **Query Embedding:** Convert natural language to 768-dim vector
2. **Vector Search:** Find top K topics and items by cosine similarity
3. **Neighbor Expansion:** Include neighbors of highest-ranked topic
4. **Edge Filtering:** Show only edges between highlighted topics
5. **Insight Generation:** Stream contextual summary using Gemini Nano with custom system prompt

### Configuration System

**Storage:** chrome.storage.sync (syncs across devices)
**Change Detection:**
- Graph settings → Recompute positions + reload edges
- UMAP params → Recompute positions only
- Search settings → No recomputation (instant)

**Default Settings:**
```typescript
{
  graph: {
    topicMergeThreshold: 0.85,
    edgeMinSimilarity: 0.6,
    maxEdgesPerNode: 5,
    clusterResolution: 1.0,
    minClusterSize: 2,
    umapMinDist: 0.4,
    umapSpread: 2.0,
  },
  search: {
    topicResultCount: 5,
    itemResultCount: 10,
    similarityThreshold: 0.4,
    maxEdgesInResults: 20,
  }
}
```

## Tech Stack

**Frontend:**
- React 19.1.0 + TypeScript
- Vite 7.0.5
- Tailwind CSS 4.1.14
- shadcn/ui (Radix UI primitives)

**3D Visualization:**
- three.js 0.180.0
- @react-three/fiber 9.4.0
- @react-three/drei 10.7.6
- @react-three/postprocessing 3.0.4

**Database:**
- Dexie 4.2.1 (IndexedDB wrapper)

**AI/ML:**
- Embeddings: Transformers.js + ONNX Runtime
- LLM: Chrome Prompt API (Gemini Nano)
- Summarization: Chrome Summarizer API
- Dimensionality Reduction: umap-js 1.4.0

**Graph Analytics:**
- graphology + graphology-communities-louvain
- Custom PCA implementation
- MST computation for cluster visualization

**Chrome APIs:**
- `sidePanel`: Main UI
- `storage`: Settings sync
- `tabs`, `scripting`: Content extraction
- `offscreen`: Embedding model hosting
- `webNavigation`: SPA tracking

## Performance

**Optimizations:**
- Instanced meshes for node rendering (single draw call)
- Precomputed positions, colors, and scales
- Memoized calculations with React.useMemo
- Efficient IndexedDB queries with composite indexes
- Lazy loading of embeddings
- Bloom effects with theme-aware parameters

**Scalability:**
- Tested with 500+ topics and 1000+ items
- UMAP computation: ~1-2s for 500 topics
- Search latency: <200ms for similarity computation

## Limitations

- **Desktop only**: Chrome's built-in AI not available on mobile
- **UMAP recomputation**: Full graph recalculation on new topics (no incremental updates)
- **English-centric**: Optimal for English content (Gemini Nano supports EN/ES/JA)
- **Storage**: Requires significant disk space for model and embeddings

## Future Work

- Incremental UMAP updates for better performance
- Export/import functionality for graph portability
- Temporal analytics and browsing pattern insights
- Advanced filtering (date ranges, topic categories)
- Collaborative knowledge sharing between users
- Mobile companion app

## License

MIT

## Acknowledgments

- Chrome Built-in AI team for Gemini Nano APIs
- Hugging Face for Transformers.js
- umap-js for dimensionality reduction
- graphology for graph algorithms
