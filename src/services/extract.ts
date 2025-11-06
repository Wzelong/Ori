import { summarize } from '../llm/summarizer';
import { generateText } from '../llm/languageModel';
import { getEmbeddingFromOffscreen, getEmbeddingsFromOffscreen } from '../llm/offscreenClient';
import type { PageResult } from '../types/schema';

async function extractPageContent() {
  const isExtensionPage = typeof window !== 'undefined' &&
    window.location.href.startsWith('chrome-extension://');

  if (!isExtensionPage && typeof window !== 'undefined' && typeof document !== 'undefined') {
    return {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText
    }
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));

  if (!tab?.id) {
    throw new Error('No valid web page tab found');
  }

  try {
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('Frame')) {
      throw new Error('Page was closed or navigated away. Please try again.');
    }
    throw error;
  }
}

const VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    reason: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['isValid', 'reason']
};

async function validateContentQuality(text: string, url: string): Promise<{ isValid: boolean; reason: string }> {
  const sampleText = text.slice(0, 3000);

  const validationJson = await generateText(
    `URL: ${url}\n\nContent preview:\n${sampleText}`,
    {
      systemPrompt: `You are a content quality validator. Determine if this page contains valuable content worth processing.

REJECT (isValid: false) if the page is:
- Search result pages (Google, Bing, Google Scholar, etc.)
- Directory/listing pages (index pages, file listings, navigation pages)
- Login/authentication pages (sign-in forms, auth pages)
- Error pages (404, 500, access denied)
- Pages with minimal or no substantial content
- Aggregated links without original content

ACCEPT (isValid: true) if the page has:
- Substantial article content (blog posts, articles, documentation, research papers)
- Educational/informational value (tutorials, guides, explanations)
- Structured information with clear topics/sections
- Original content (not just metadata or links)

Return JSON with:
- isValid: boolean (true if content should be processed)
- reason: string (brief explanation of decision)
- confidence: number (0-1, how confident you are)

Be strict - when in doubt, reject.`,
      schema: VALIDATION_SCHEMA
    }
  );

  const validation = JSON.parse(validationJson);
  return { isValid: validation.isValid, reason: validation.reason };
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

export async function extractPageResultFromData(pageData: { title: string; url: string; text: string }): Promise<PageResult> {
  // 1. Use provided page content
  const extracted = pageData;

  // 2. Validate content quality
  const validation = await validateContentQuality(extracted.text, extracted.url);
  if (!validation.isValid) {
    throw new Error(`Content validation failed: ${validation.reason}`);
  }

  const summarizerText = extracted.text.slice(0, 15000);

  // 3. Generate summary
  const summary = await summarize(summarizerText);

  // 4. Extract topics from summary
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

  // 5. Create embeddings
  const topicEmbeddingsTensor = await getEmbeddingsFromOffscreen(metadata.topics, 'doc');
  const topicEmbeddings = topicEmbeddingsTensor.tolist() as number[][];
  const contentEmbedding = await getEmbeddingFromOffscreen(summary, 'doc', metadata.title);

  return {
    title: metadata.title,
    summary,
    topics: metadata.topics,
    link: extracted.url,
    topicEmbeddings,
    contentEmbedding
  };
}

export async function extractPageResult(): Promise<PageResult> {
  // 1. Extract page content
  const extracted = await extractPageContent();

  // 2. Validate content quality
  const validation = await validateContentQuality(extracted.text, extracted.url);
  if (!validation.isValid) {
    throw new Error(`Content validation failed: ${validation.reason}`);
  }

  const summarizerText = extracted.text.slice(0, 15000);

  // 3. Generate summary
  const summary = await summarize(summarizerText);

  // 4. Extract topics from summary
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

  // 5. Create embeddings
  const topicEmbeddingsTensor = await getEmbeddingsFromOffscreen(metadata.topics, 'doc');
  const topicEmbeddings = topicEmbeddingsTensor.tolist() as number[][];
  const contentEmbedding = await getEmbeddingFromOffscreen(summary, 'doc', metadata.title);

  return {
    title: metadata.title,
    summary,
    topics: metadata.topics,
    link: extracted.url,
    topicEmbeddings,
    contentEmbedding
  };
}
