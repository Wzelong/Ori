import { generateTextStreaming } from '@/llm/languageModel';
import type { ItemSearchResult } from './search';

export interface InsightContext {
  stream: ReadableStream<string>;
  itemMap: Map<string, string>;
}

export async function generateInsight(
  query: string,
  itemResults: ItemSearchResult[]
): Promise<InsightContext> {
  const contextParts: string[] = [];
  const itemMap = new Map<string, string>();

  if (itemResults.length > 0) {
    itemResults.forEach((r, i) => {
      contextParts.push(`[${i + 1}] Title: ${r.item.title}`);
      contextParts.push(`Link: ${r.item.link}`);
      if (r.item.summary) {
        const summary = r.item.summary.replace(/\n/g, ' ').substring(0, 300);
        contextParts.push(`Summary: ${summary}`);
      }
      contextParts.push('');

      itemMap.set(r.item.title, r.item.link);
    });
  }

  const context = contextParts.join('\n');

  const systemPrompt = `You help users understand their browsing history. Respond in 1-2 sentences maximum. Count items read, suggest one specific action using exact title in format: **Title Here**. Be extremely concise.`;

  const userPrompt = `Browsing history:\n${context}\nQuery: ${query}`;

  const stream = await generateTextStreaming(userPrompt, { systemPrompt });

  return { stream, itemMap };
}
