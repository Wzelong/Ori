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
    temperature: 0.1,
    topK: 1,
  });

  const promptOptions = options?.schema
    ? { responseConstraint: options.schema }
    : undefined;

  return await session.prompt(userPrompt, promptOptions);
}
