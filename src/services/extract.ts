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
      minItems: 1,
      maxItems: 3
    }
  },
  required: ['title', 'topics']
};

export async function extractPageResult(): Promise<PageResult> {
  // 1. Extract page content
  const extracted = await extractPageContent();

  const summarizerText = extracted.text.slice(0, 20000);
  const llmText = extracted.text.slice(0, 20000);

  const userPrompt = `Original title: ${extracted.title}

Content:
${llmText}`;

  console.log('[extract] Total user prompt length:', userPrompt.length);

  // 2. Generate topics and summary
  const [summary, metadataJson] = await Promise.all([
    summarize(summarizerText),
    generateText(
      userPrompt,
      {
        systemPrompt: `You extract concise, high-quality metadata from technical or academic web text.
Return JSON ONLY with this schema:
{"title": "...", "topics": ["...", "...", "..."]}

Rules:
TITLE
- Keep short, clear, and descriptive (≤12 words).
- Remove source/site names, dates, and extra punctuation.

TOPICS (1–3)
- Extract 1–3 *core technical concepts* that the text is primarily about.
- Each topic: short noun phrase (1–4 words), lowercase, singular form.
- Choose the most *specific and technical* terms, not general fields.
  Wrong: too broad: "artificial intelligence", "computer science"
  Correct: specific: "text embedding", "contrastive learning", "vector quantization"
- Expand abbreviations and acronyms (e.g., "LLM" → "large language model").
- Merge synonyms or duplicates.
- If multiple levels exist, choose the *most specific meaningful one* (e.g., "sentence embedding" instead of "embedding").
- Prefer method or object-level topics (models, algorithms, data types) over general domains.
- Avoid adjectives like "novel", "improved", "efficient".

Return clean, valid JSON only.

`,
        schema: METADATA_SCHEMA
      }
    )
  ]);

  const metadata = JSON.parse(metadataJson);

  // 3. Create embeddings
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
