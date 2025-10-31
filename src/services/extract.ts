import { summarize } from '../llm/summarizer';
import { generateText } from '../llm/languageModel';
import { getEmbedding, getEmbeddings } from '../llm/embeddings';
import type { PageResult } from '../types/schema';

async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.id) {
    throw new Error('No active tab found');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.title,
      url: window.location.href,
      text: document.body.innerText
    })
  });

  if (!results[0]?.result) {
    throw new Error('Failed to extract content');
  }

  return results[0].result;
}

const METADATA_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    topics: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4
    }
  },
  required: ['title', 'topics']
};

export async function extractPageResult(): Promise<PageResult> {
  // 1. Extract page content
  const extracted = await extractPageContent();

  const summarizerText = extracted.text.slice(0, 20000);

  // 2. Generate summary first
  const summary = await summarize(summarizerText);

  // 3. Extract topics from summary
  const userPrompt = `Original title: ${extracted.title}

Summary:
${summary}`;

  const metadataJson = await generateText(
    userPrompt,
    {
      systemPrompt: `You extract concise, high-quality metadata from summarized web text.
Return JSON ONLY with this schema:
{"title": "...", "topics": ["core-concept", "related-1", "related-2", "related-3"]}

Rules:
TITLE
- Keep short, clear, and descriptive (≤12 words).
- Remove source/site names, dates, and extra punctuation.

TOPICS (2–4 total)
Extract topics in this order:
1. FIRST topic: The single most important SPECIFIC concept this page is fundamentally about
   - NOT a broad field like "Artificial Intelligence" or "Quantum Mechanics"
   - The CORE subject the page focuses on
2. REMAINING topics (2–3): Related concepts that explore depth and breadth from the given summary
   - Context, applications, related techniques, or closely connected concepts

For each topic:
- Short noun phrase (1–4 words), lowercase, singular form
- Expand abbreviations and acronyms (e.g., "LLM" → "large language model")
- Avoid adjectives like "novel", "improved", "efficient"

Return clean, valid JSON only.
`,
      schema: METADATA_SCHEMA
    }
  );

  const metadata = JSON.parse(metadataJson);

  // 4. Create embeddings
  const topicEmbeddingsTensor = await getEmbeddings(metadata.topics);
  const topicEmbeddings = topicEmbeddingsTensor.tolist() as number[][];
  const contentEmbedding = await getEmbedding(`Title: ${metadata.title}\n\n${summary}`);

  return {
    title: metadata.title,
    summary,
    topics: metadata.topics,
    link: extracted.url,
    topicEmbeddings,
    contentEmbedding
  };
}
