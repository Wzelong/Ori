export async function generateText(
  userPrompt: string,
  options?: {
    systemPrompt?: string;
    schema?: object;
  }
): Promise<string> {
  const availability = await (self as any).LanguageModel.availability();

  if (availability === 'unavailable') {
    throw new Error('Language Model API is unavailable. Enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input');
  }

  if (availability === 'downloading') {
    throw new Error('Language model is downloading (~1-2 GB). Please wait and try again.');
  }

  const initialPrompts = options?.systemPrompt
    ? [{ role: 'system', content: options.systemPrompt }]
    : [];

  try {
    const session = await (self as any).LanguageModel.create({
      initialPrompts,
      temperature: 0.5,
      topK: 1,
      outputLanguage: "en"
    });
    return await session.prompt(userPrompt, options?.schema ? { responseConstraint: options.schema } : undefined);
  } catch (error) {
    if (error instanceof Error && error.message.includes('user gesture')) {
      throw new Error('Model download requires user interaction. Click Extract to start download.');
    }
    throw error;
  }

}

export async function generateTextStreaming(
  userPrompt: string,
  options?: {
    systemPrompt?: string;
  }
): Promise<ReadableStream<string>> {
  const availability = await (self as any).LanguageModel.availability();

  if (availability === 'unavailable') {
    throw new Error('Language Model API is unavailable. Enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input');
  }

  if (availability === 'downloading') {
    throw new Error('Language model is downloading (~1-2 GB). Please wait and try again.');
  }

  const initialPrompts = options?.systemPrompt
    ? [{ role: 'system', content: options.systemPrompt }]
    : [];

  try {
    const session = await (self as any).LanguageModel.create({
      initialPrompts,
      temperature: 0.5,
      topK: 1,
      outputLanguage: "en"
    });
    return session.promptStreaming(userPrompt);
  } catch (error) {
    if (error instanceof Error && error.message.includes('user gesture')) {
      throw new Error('Model download requires user interaction. Click Extract to start download.');
    }
    throw error;
  }
}
