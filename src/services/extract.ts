import { summarize } from '../llm/summarizer';
import { generateText } from '../llm/languageModel';
import { getEmbeddingFromOffscreen, getEmbeddingsFromOffscreen } from '../llm/offscreenClient';
import type { PageResult } from '../types/schema';
import { EXTRACTION, METADATA } from '../config/constants';
import {
  CONTENT_VALIDATION_PROMPT,
  METADATA_EXTRACTION_PROMPT,
  createValidationUserPrompt,
  createMetadataUserPrompt
} from '../config/prompts';

/**
 * Extracts content from the current web page
 * @returns Page content including title, URL, and text
 * @throws {Error} If no valid web page tab is found or extraction fails
 */
async function extractPageContent() {
  const isExtensionPage = typeof window !== 'undefined' &&
    window.location.href.startsWith('chrome-extension://');

  if (!isExtensionPage && typeof window !== 'undefined' && typeof document !== 'undefined') {
    return {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText
    }
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));

  if (!tab?.id) {
    throw new Error('No valid web page tab found');
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: window.location.href,
        text: document.body.innerText
      })
    });

    if (!results[0]?.result) {
      throw new Error('Failed to extract content');
    }

    return results[0].result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Frame')) {
      throw new Error('Page was closed or navigated away. Please try again.');
    }
    throw error;
  }
}

const VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    reason: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['isValid', 'reason']
};

/**
 * Validates if page content is worth processing using LLM-based quality assessment
 * @param text - Page text content
 * @param url - Page URL for context
 * @returns Validation result with boolean flag and reason
 */
async function validateContentQuality(text: string, url: string): Promise<{ isValid: boolean; reason: string }> {
  const sampleText = text.slice(0, EXTRACTION.VALIDATION_SAMPLE_LENGTH);

  const validationJson = await generateText(
    createValidationUserPrompt(url, sampleText),
    {
      systemPrompt: CONTENT_VALIDATION_PROMPT,
      schema: VALIDATION_SCHEMA
    }
  );

  const validation = JSON.parse(validationJson);
  return { isValid: validation.isValid, reason: validation.reason };
}

const METADATA_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    topics: {
      type: 'array',
      items: { type: 'string' },
      minItems: METADATA.MIN_TOPICS_PER_PAGE,
      maxItems: METADATA.MAX_TOPICS_PER_PAGE
    }
  },
  required: ['title', 'topics']
};

/**
 * Extracts metadata (title and topics) from page summary using LLM
 * @param summary - Summarized page content
 * @param originalTitle - Original page title for context
 * @returns Metadata object with refined title and extracted topics
 */
async function extractMetadata(summary: string, originalTitle: string): Promise<{ title: string; topics: string[] }> {
  const metadataJson = await generateText(
    createMetadataUserPrompt(originalTitle, summary),
    {
      systemPrompt: METADATA_EXTRACTION_PROMPT,
      schema: METADATA_SCHEMA
    }
  );

  return JSON.parse(metadataJson);
}

/**
 * Generates embeddings for topics and content summary
 * @param topics - Array of topic strings
 * @param summary - Content summary text
 * @param title - Page title
 * @returns Object containing topic embeddings array and content embedding
 */
async function generateEmbeddings(
  topics: string[],
  summary: string,
  title: string
): Promise<{ topicEmbeddings: number[][]; contentEmbedding: number[] }> {
  const topicEmbeddingsTensor = await getEmbeddingsFromOffscreen(topics, 'doc');
  const topicEmbeddings = topicEmbeddingsTensor.tolist() as number[][];
  const contentEmbedding = await getEmbeddingFromOffscreen(summary, 'doc', title);

  return { topicEmbeddings, contentEmbedding };
}

/**
 * Processes page data through the full extraction pipeline
 * @param pageData - Raw page data (title, URL, text)
 * @returns Complete PageResult with all extracted metadata and embeddings
 * @throws {Error} If content validation fails
 */
async function processPageData(pageData: { title: string; url: string; text: string }): Promise<PageResult> {
  const validation = await validateContentQuality(pageData.text, pageData.url);
  if (!validation.isValid) {
    throw new Error(`Content validation failed: ${validation.reason}`);
  }

  const summarizerText = pageData.text.slice(0, EXTRACTION.SUMMARIZER_MAX_LENGTH);
  const summary = await summarize(summarizerText);
  const metadata = await extractMetadata(summary, pageData.title);
  const { topicEmbeddings, contentEmbedding } = await generateEmbeddings(metadata.topics, summary, metadata.title);

  return {
    title: metadata.title,
    summary,
    topics: metadata.topics,
    link: pageData.url,
    topicEmbeddings,
    contentEmbedding
  };
}

/**
 * Extracts and processes page result from provided page data
 * @param pageData - Raw page data (title, URL, text)
 * @returns Complete PageResult with extracted metadata and embeddings
 * @throws {Error} If content validation fails
 */
export async function extractPageResultFromData(pageData: { title: string; url: string; text: string }): Promise<PageResult> {
  return processPageData(pageData);
}

/**
 * Extracts and processes page result from the current active tab
 * @returns Complete PageResult with extracted metadata and embeddings
 * @throws {Error} If page extraction or content validation fails
 */
export async function extractPageResult(): Promise<PageResult> {
  const extracted = await extractPageContent();
  return processPageData(extracted);
}
