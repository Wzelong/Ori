import { extractPageContent } from '../extract/pageExtractor';
import { summarize } from '../llm/summarizer';
import { generateText } from '../llm/languageModel';
import type { ProcessedPage } from '../types';

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

export async function processPage(): Promise<ProcessedPage> {
  const extracted = await extractPageContent();
  const truncatedText = extracted.text.slice(0, 20000);

  const [summary, metadataJson] = await Promise.all([
    summarize(truncatedText),
    generateText(
      `Original title: ${extracted.title}

Content:
${truncatedText}`,
      {
        systemPrompt: `You extract clean metadata from web content.

TITLE
- Keep concise and descriptive
- Preserve the core meaning

TOPICS (max 3, most specific/core only)
- Extract 1-3 most specific core topics
- Each topic is a concise noun phrase (1–4 words), lowercase, singular.
- Prefer specific concepts (methods, models, datasets, findings). No umbrella or broad areas.
- No generic terms (avoid "AI", "technology", "data science")
- Use canonical academic terms (expand abbreviations: "llm" → "large language model")
- No duplicates or near-duplicates

Return JSON only.`,
        schema: METADATA_SCHEMA
      }
    )
  ]);

  const metadata = JSON.parse(metadataJson);

  return {
    title: metadata.title,
    summary,
    topics: metadata.topics,
    link: extracted.url
  };
}
