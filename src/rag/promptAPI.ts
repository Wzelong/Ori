export interface PromptOptions {
  systemPrompt?: string
  temperature?: number
  topK?: number
}

export async function queryAI(
  prompt: string,
  options?: PromptOptions
): Promise<string> {
  return ''
}

export async function checkPromptAPIAvailability(): Promise<boolean> {
  if (!('ai' in self) || !('languageModel' in (self as any).ai)) {
    return false
  }

  return true
}
