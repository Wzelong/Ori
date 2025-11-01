const MAX_SUMMARIZER_LENGTH = 15000;

export async function summarize(text: string): Promise<string> {

  const truncatedText = text.slice(0, MAX_SUMMARIZER_LENGTH);
  if (truncatedText.length < text.length) {
  }

  const availability = await (self as any).Summarizer.availability();

  if (availability === 'unavailable') {
    throw new Error('Summarizer API is unavailable');
  }

  const summarizer = await (self as any).Summarizer.create({
    type: 'key-points',
    length: 'short',
    format: 'markdown',
    expectedInputLanguages: ["en"],
    outputLanguage: "en",
  });

  try {
    const result = await summarizer.summarize(truncatedText);
    return result;
  } catch (err) {
    console.error('[summarize] Failed with text length:', truncatedText.length, err);
    throw err;
  }
}
