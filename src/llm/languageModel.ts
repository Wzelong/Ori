export async function generateText(
  userPrompt: string,
  options?: {
    systemPrompt?: string;
    schema?: object;
  }
): Promise<string> {
  const availability = await (self as any).LanguageModel.availability();

  if (availability === 'unavailable') {
    throw new Error('Language Model API is unavailable');
  }

  const initialPrompts = options?.systemPrompt
    ? [{ role: 'system', content: options.systemPrompt }]
    : [];

  const session = await (self as any).LanguageModel.create({
    initialPrompts,
    temperature: 0.5,
    topK: 1,
    outputLanguage: "en"
  });

  const promptOptions = options?.schema
    ? { responseConstraint: options.schema }
    : undefined;

  return await session.prompt(userPrompt, promptOptions);
}

export async function generateTextStreaming(
  userPrompt: string,
  options?: {
    systemPrompt?: string;
  }
): Promise<ReadableStream<string>> {
  const availability = await (self as any).LanguageModel.availability();

  if (availability === 'unavailable') {
    throw new Error('Language Model API is unavailable');
  }

  const initialPrompts = options?.systemPrompt
    ? [{ role: 'system', content: options.systemPrompt }]
    : [];

  const session = await (self as any).LanguageModel.create({
    initialPrompts,
    temperature: 0.5,
    topK: 1,
    outputLanguage: "en"
  });

  return session.promptStreaming(userPrompt);
}
