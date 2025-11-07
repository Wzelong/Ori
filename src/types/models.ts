/**
 * Type definitions for AI models and transformers
 */
import type { PreTrainedTokenizer, PreTrainedModel } from '@huggingface/transformers';

/**
 * Tokenizer instance type for embedding model
 */
export type EmbeddingTokenizer = PreTrainedTokenizer;

/**
 * Model instance type for embedding generation
 */
export type EmbeddingModel = PreTrainedModel;

/**
 * Model inputs after tokenization
 */
export interface TokenizerInputs {
  input_ids: unknown;
  attention_mask?: unknown;
  [key: string]: unknown;
}

/**
 * Model outputs from embedding model
 */
export interface EmbeddingModelOutput {
  sentence_embedding: {
    tolist(): number[][];
  };
  [key: string]: unknown;
}
