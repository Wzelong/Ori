export async function summarize(text: string): Promise<string> {
  console.log('[summarize] Input length:', text.length);

  const availability = await (self as any).Summarizer.availability();

  if (availability === 'unavailable') {
    throw new Error('Summarizer API is unavailable');
  }

  const summarizer = await (self as any).Summarizer.create({
    type: 'key-points',
    length: 'short',
    format: 'markdown',
    sharedContext: 'Output language: en'
  });

  try {
    const result = await summarizer.summarize(text);
    console.log('[summarize] Success');
    return result;
  } catch (err) {
    console.error('[summarize] Failed with text length:', text.length, err);
    throw err;
  }
}
