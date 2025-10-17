export interface SummarizerOptions {
  type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline'
  length?: 'short' | 'medium' | 'long'
  context?: string
}

export async function summarizeContent(
  content: string,
  options?: SummarizerOptions
): Promise<string> {
  return ''
}

export async function checkSummarizerAvailability(): Promise<boolean> {
  if (!('ai' in self) || !('summarizer' in (self as any).ai)) {
    return false
  }

  return true
}
