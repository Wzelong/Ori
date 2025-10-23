export async function summarize(text: string): Promise<string> {
  const availability = await (self as any).Summarizer.availability();

  if (availability === 'unavailable') {
    throw new Error('Summarizer API is unavailable');
  }

  const summarizer = await (self as any).Summarizer.create({
    type: 'key-points',
    length: 'short',
    format: 'markdown'
  });

  return await summarizer.summarize(text);
}
