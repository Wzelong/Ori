interface AI {
  languageModel: AILanguageModelFactory
  summarizer: AISummarizerFactory
  translator: AITranslatorFactory
}

interface AILanguageModelFactory {
  create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>
  capabilities(): Promise<AILanguageModelCapabilities>
}

interface AILanguageModelCreateOptions {
  systemPrompt?: string
  temperature?: number
  topK?: number
}

interface AILanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no'
  defaultTemperature?: number
  defaultTopK?: number
  maxTopK?: number
}

interface AILanguageModel {
  prompt(input: string): Promise<string>
  promptStreaming(input: string): ReadableStream
  destroy(): void
}

interface AISummarizerFactory {
  create(options?: AISummarizerCreateOptions): Promise<AISummarizer>
  capabilities(): Promise<AISummarizerCapabilities>
}

interface AISummarizerCreateOptions {
  type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline'
  length?: 'short' | 'medium' | 'long'
  context?: string
}

interface AISummarizerCapabilities {
  available: 'readily' | 'after-download' | 'no'
}

interface AISummarizer {
  summarize(input: string): Promise<string>
  summarizeStreaming(input: string): ReadableStream
  destroy(): void
}

interface AITranslatorFactory {
  create(options: AITranslatorCreateOptions): Promise<AITranslator>
  capabilities(): Promise<AITranslatorCapabilities>
}

interface AITranslatorCreateOptions {
  sourceLanguage: string
  targetLanguage: string
}

interface AITranslatorCapabilities {
  available: 'readily' | 'after-download' | 'no'
  languagePairAvailable(
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<'readily' | 'after-download' | 'no'>
}

interface AITranslator {
  translate(input: string): Promise<string>
  destroy(): void
}

interface WindowOrWorkerGlobalScope {
  readonly ai: AI
}
