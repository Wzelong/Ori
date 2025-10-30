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
  const truncatedText = extracted.text.slice(0, 20000);

  // 2. Generate topics and summary
  const [summary, metadataJson] = await Promise.all([
    summarize(truncatedText),
    generateText(
      `Original title: ${extracted.title}

Content:
${truncatedText}`,
      {
        systemPrompt: `You extract clean metadata from web text.

TITLE
- short and descriptive

TOPICS (1–3)
- extract 1–3 core topics only
- each topic: short noun phrase (1–4 words), lowercase, singular
- choose the most specific technical terms
- no broad or generic words
- expand abbreviations (e.g. "llm" → "large language model")
- always use singular form even if plural in text
- no duplicates

Return JSON only:
{"title": "...", "topics": ["...", "..."]}
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
