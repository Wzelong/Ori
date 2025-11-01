# Ori

An intelligent Chrome extension that transforms your browsing history into an interactive 3D knowledge graph using on-device AI.

## Problem Statement

Traditional browser bookmarks and history are flat, disconnected lists that fail to capture the semantic relationships between the content you consume. Users cannot discover connections between topics, search by meaning rather than keywords, or gain insights about their learning patterns over time.

## Solution

Ori automatically builds a living semantic knowledge graph from your browsing activity. It captures valuable content as you browse, understands context through AI summarization and topic extraction, discovers relationships between concepts via vector similarity, and visualizes connections in an interactive 3D star map. The system generates contextual insights using retrieval-augmented generation over your browsing history while operating entirely offline with on-device AI for privacy.

Key advantages:
- **On-device processing**: All AI operations run locally using Chrome's built-in Gemini Nano. No cloud API calls.
- **Semantic organization**: Content grouped by meaning, not manual folders.
- **Automatic graph construction**: Zero manual tagging required.
- **3D spatial visualization**: Intuitive metaphor for knowledge exploration.
- **Conversational insights**: RAG-powered interface over your history.

## Installation

### Prerequisites

Chrome Canary with the following experimental features enabled:

```
chrome://flags/#prompt-api-for-gemini-nano
chrome://flags/#summarization-api-for-gemini-nano
chrome://flags/#optimization-guide-on-device-model
```

Set all three to "Enabled" and restart Chrome.

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

## Tech Stack

### Frontend
- React 19.1.0 + TypeScript
- Vite 7.0.5 build system
- Tailwind CSS 4.1.14 for styling
- shadcn/ui components (Radix UI primitives)

### 3D Visualization
- three.js 0.180.0
- @react-three/fiber 9.4.0
- @react-three/drei 10.7.6
- @react-three/postprocessing 3.0.4 (Bloom effects)

### Database
- Dexie 4.2.1 (IndexedDB wrapper)
- Schema: topics, items, item_topic, topic_edges, vectors

### AI/ML
- **Embeddings**: Hugging Face Transformers.js with onnx-community/embeddinggemma-300m-ONNX (768-dimensional vectors)
- **LLM**: Chrome Prompt API (Gemini Nano)
- **Summarization**: Chrome Summarizer API
- **Dimensionality Reduction**: umap-js 1.4.0 with custom PCA implementation

### Chrome APIs
- `chrome.runtime`: Message passing between components
- `chrome.tabs`: Content extraction from active tabs
- `chrome.scripting`: Script injection for content access
- `chrome.storage`: Settings synchronization
- `chrome.sidePanel`: Side panel UI hosting
- `chrome.offscreen`: WASM embedding model hosting (bypasses service worker limitations)
- `chrome.webNavigation`: SPA navigation tracking

## Functionality

### Content Extraction
Automatically extracts page title, URL, and body text from visited pages. Smart validation rejects low-quality content (search results, login pages, error pages, listing pages). Generates AI summaries using Gemini Nano in key-points format. Extracts 2-4 topics per page using structured JSON output. Creates 768-dimensional vector embeddings for both topics and content.

### Knowledge Graph Construction
Merges similar topics using 0.92 cosine similarity threshold. Connects related topics with edges at 0.86 minimum similarity. Enforces maximum 5 edges per node to prevent visual clutter. Deduplicates by URL and semantic similarity. Triggers 3D position recomputation after graph updates.

### 3D Visualization
Renders topics as glowing spheres in 3D space using instanced meshes for performance. Positions computed via PCA (768D to 100D) followed by UMAP (100D to 3D). Bloom effects highlight search results. Interactive camera controls with smooth animations. Theme-aware rendering for dark and light modes. Click interactions reveal related pages.

### Semantic Search
Converts natural language queries to embeddings. Finds top 5 similar topics and top 10 similar items with 0.8 similarity threshold. Highlights results in 3D space with automatic camera focus. Displays edges between highlighted topics.

### RAG-Powered Insights
Streams contextual summaries about user queries. Counts related pages and mentions key themes. Suggests actionable next steps with hyperlinked references to specific pages. Operates entirely on-device using Chrome's Prompt API.

### Inspect View
Table view of all topics and items. Sortable by usage count and creation date. Direct links to original pages.

## Architecture

### Vector Embeddings
768-dimensional embeddings stored as ArrayBuffer in IndexedDB. Used for semantic similarity computation across both topics and items. Enables topic merging and content search.

### UMAP Dimensionality Reduction
Flow: 768D embeddings → PCA to 100D → UMAP to 3D coordinates. Parameters: nNeighbors = min(15, topics/2), minDist = 0.1, spread = 1.0. Normalized to [-10, 10] cube for rendering.

### Topic Extraction and Merging
LLM with JSON schema constraint outputs 2-4 topics per page. First topic represents core concept (specific, not broad). Remaining topics are related concepts. Similarity matrix computation identifies duplicates at 0.92 threshold for automatic merging.

### Graph Edge Creation
When new topics are inserted, compute similarity against all existing topics. Create edges for pairs exceeding 0.86 similarity. Sort by similarity and enforce maximum 5 edges per node.

### Offscreen Document Pattern
Service workers cannot execute WASM. Embedding model hosted in persistent offscreen document. Communication via chrome.runtime.sendMessage. Ensures embedding generation remains available throughout extension lifecycle.

## Known Limitations

- **Auto-extraction mode**: Currently in beta. Requires additional testing for edge cases and reliability improvements.
- **3D graph performance**: Not fully optimized. Observable lag when adding new nodes due to UMAP recomputation on the full graph.

## Future Work

- Performance optimization for 3D graph rendering and UMAP incremental updates
- Multi-language support for international content
- Export and import capabilities for knowledge graph portability
- Advanced filtering and temporal analytics
- Collaborative knowledge sharing between users
- Mobile companion application for cross-device access
