/**
 * Custom error classes for type-safe error handling across the application
 */

/**
 * Base class for all application errors
 * Extends Error with additional context and error codes
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Errors related to page content extraction
 */
export class ExtractionError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EXTRACTION_ERROR', context);
  }

  static invalidContent(reason: string): ExtractionError {
    return new ExtractionError(`Invalid content: ${reason}`, { reason });
  }

  static noValidTab(): ExtractionError {
    return new ExtractionError('No valid web page tab found');
  }

  static pageNavigated(): ExtractionError {
    return new ExtractionError('Page was closed or navigated away. Please try again.');
  }

  static extractionFailed(details?: string): ExtractionError {
    return new ExtractionError('Failed to extract content', { details });
  }

  static validationFailed(reason: string): ExtractionError {
    return new ExtractionError(`Content validation failed: ${reason}`, { reason });
  }
}

/**
 * Errors related to database operations
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', context);
  }

  static transactionFailed(operation: string, originalError?: Error): DatabaseError {
    return new DatabaseError(`Transaction failed: ${operation}`, {
      operation,
      originalError: originalError?.message
    });
  }

  static notFound(entityType: string, id: string): DatabaseError {
    return new DatabaseError(`${entityType} not found`, { entityType, id });
  }

  static duplicate(entityType: string, identifier: string): DatabaseError {
    return new DatabaseError(`${entityType} already exists`, { entityType, identifier });
  }
}

/**
 * Errors related to AI model operations
 */
export class ModelError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MODEL_ERROR', context);
  }

  static loadFailed(modelId: string, originalError?: Error): ModelError {
    return new ModelError(`Failed to load model: ${modelId}`, {
      modelId,
      originalError: originalError?.message
    });
  }

  static inferenceTimeout(operation: string): ModelError {
    return new ModelError(`Model inference timeout: ${operation}`, { operation });
  }

  static invalidInput(reason: string): ModelError {
    return new ModelError(`Invalid model input: ${reason}`, { reason });
  }

  static notAvailable(modelType: string): ModelError {
    return new ModelError(`Model not available: ${modelType}`, { modelType });
  }
}

/**
 * Errors related to input validation
 */
export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', { ...context, field });
    this.field = field;
  }

  static required(field: string): ValidationError {
    return new ValidationError(`${field} is required`, field);
  }

  static invalid(field: string, reason: string): ValidationError {
    return new ValidationError(`${field} is invalid: ${reason}`, field, { reason });
  }

  static outOfRange(field: string, min: number, max: number, actual: number): ValidationError {
    return new ValidationError(
      `${field} must be between ${min} and ${max}, got ${actual}`,
      field,
      { min, max, actual }
    );
  }
}

/**
 * Errors related to graph operations
 */
export class GraphError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GRAPH_ERROR', context);
  }

  static computationFailed(operation: string, originalError?: Error): GraphError {
    return new GraphError(`Graph computation failed: ${operation}`, {
      operation,
      originalError: originalError?.message
    });
  }

  static invalidStructure(reason: string): GraphError {
    return new GraphError(`Invalid graph structure: ${reason}`, { reason });
  }
}

/**
 * Errors related to vector operations
 */
export class VectorError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VECTOR_ERROR', context);
  }

  static dimensionMismatch(expected: number, actual: number): VectorError {
    return new VectorError('Vector dimension mismatch', { expected, actual });
  }

  static emptyDataset(): VectorError {
    return new VectorError('Cannot perform operation on empty dataset');
  }

  static computationFailed(operation: string, originalError?: Error): VectorError {
    return new VectorError(`Vector computation failed: ${operation}`, {
      operation,
      originalError: originalError?.message
    });
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Formats error for user display
 * @param error - Error to format
 * @returns User-friendly error message
 */
export function formatErrorForUser(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Formats error for logging with full context
 * @param error - Error to format
 * @returns Detailed error information
 */
export function formatErrorForLogging(error: unknown): string {
  if (isAppError(error)) {
    const context = error.context ? JSON.stringify(error.context) : 'none';
    return `[${error.code}] ${error.message} | Context: ${context} | Stack: ${error.stack}`;
  }

  if (error instanceof Error) {
    return `${error.message} | Stack: ${error.stack}`;
  }

  return String(error);
}
