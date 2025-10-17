# Trace — Chrome Built-in AI Challenge 2025

Your personal knowledge graph powered by Chrome built-in AI. Automatically capture, summarize, and structure knowledge from web pages and YouTube videos into a private local knowledge graph.

## Overview

Trace is a Chrome extension that leverages Gemini Nano's built-in AI APIs (Prompt API, Summarizer API, Translator API) to transform your browsing history into an intelligent, searchable knowledge base. All processing happens on-device for privacy and offline use.

## Features

- **Automatic Capture**: Extract content from web pages and YouTube videos
- **AI Summarization**: Generate summaries using Chrome's built-in Summarizer API
- **Knowledge Graph**: Build connections between related content
- **Semantic Search**: Query your knowledge base with natural language
- **Privacy First**: All data stored locally using IndexedDB (Dexie)
- **Offline Ready**: No external API calls, works completely offline

## Tech Stack

- **Framework**: React + TypeScript
- **Build Tool**: Vite + CRXJS
- **Styling**: TailwindCSS + shadcn/ui (Slate theme)
- **Database**: Dexie (IndexedDB wrapper)
- **AI**: Chrome Built-in APIs (Gemini Nano)
  - Prompt API
  - Summarizer API
  - Translator API

## Project Structure

```
trace/
├─ src/
│  ├─ background/       # Service worker (AI processing, storage)
│  ├─ content/          # Content scripts (DOM extraction)
│  ├─ popup/            # Quick access popup UI
│  ├─ sidepanel/        # Main panel UI
│  ├─ options/          # Settings page
│  ├─ components/ui/    # shadcn/ui components
│  ├─ db/               # Dexie schema & database
│  ├─ extract/          # Page/video parsing utilities
│  ├─ rag/              # Retrieval & summarization logic
│  ├─ types/            # TypeScript definitions
│  └─ utils/            # Common helpers
├─ public/icons/        # Extension icons
└─ manifest.config.ts   # Chrome extension manifest
```

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome Browser (with AI features enabled)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Load extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Build for Production

```bash
npm run build
```

The packaged extension will be in the `release` directory.

## Chrome AI APIs Setup

To use Chrome's built-in AI features:

1. Use Chrome Canary or Dev channel
2. Enable flags at `chrome://flags`:
   - `#optimization-guide-on-device-model`
   - `#prompt-api-for-gemini-nano`
   - `#summarization-api-for-gemini-nano`

## Development

### Key Files

- `src/background/background.ts` - Service worker entry point
- `src/content/contentScript.ts` - Content script for page extraction
- `src/db/db.ts` - Database schema and models
- `src/rag/summarizer.ts` - AI summarization logic
- `src/rag/promptAPI.ts` - AI prompt interface
- `src/rag/retrieval.ts` - Knowledge base search

## License

MIT

## Contributing

Contributions welcome! This project is part of the Chrome Built-in AI Challenge 2025.
