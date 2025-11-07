/**
 * Application-wide constants and configuration values
 */

export const EXTRACTION = {
  /**
   * Maximum text length for content validation sample (in characters)
   */
  VALIDATION_SAMPLE_LENGTH: 3000,

  /**
   * Maximum text length for summarization (in characters)
   */
  SUMMARIZER_MAX_LENGTH: 15000,

  /**
   * Debounce delay for auto-extraction in milliseconds
   */
  AUTO_EXTRACT_DEBOUNCE_MS: 2000,

  /**
   * Time window to detect duplicate extractions in milliseconds
   */
  DUPLICATE_DETECTION_WINDOW_MS: 60000,

  /**
   * Timeout for extraction operations in milliseconds
   */
  EXTRACTION_TIMEOUT_MS: 300000,
} as const;

export const GRAPH = {
  /**
   * Maximum number of edges per topic node
   */
  MAX_EDGES_PER_NODE: 5,

  /**
   * Minimum similarity threshold for creating edges between topics
   */
  MIN_EDGE_SIMILARITY: 0.6,

  /**
   * Similarity threshold for merging similar topics
   */
  TOPIC_MERGE_THRESHOLD: 0.85,
} as const;

export const DIMENSIONALITY = {
  /**
   * Number of principal components for PCA dimensionality reduction
   */
  PCA_COMPONENTS: 100,

  /**
   * Number of neighbors for UMAP algorithm
   */
  UMAP_NEIGHBORS: 15,

  /**
   * Minimum distance parameter for UMAP
   */
  UMAP_MIN_DIST: 0.1,

  /**
   * Target dimensions for UMAP output (3D visualization)
   */
  UMAP_TARGET_DIMENSIONS: 3,
} as const;

export const CLUSTERING = {
  /**
   * Resolution parameter for Louvain clustering algorithm
   * Higher values create more, smaller clusters
   */
  LOUVAIN_RESOLUTION: 1.0,

  /**
   * Minimum cluster size to display
   */
  MIN_CLUSTER_SIZE: 2,
} as const;

export const SEARCH = {
  /**
   * Default number of top results to return
   */
  DEFAULT_TOP_K: 10,

  /**
   * Minimum similarity score for search results
   */
  MIN_SIMILARITY_THRESHOLD: 0.3,

  /**
   * Number of neighbors to expand for context
   */
  NEIGHBOR_EXPANSION_DEPTH: 1,

  /**
   * Maximum number of items to include in RAG context
   */
  MAX_RAG_CONTEXT_ITEMS: 5,
} as const;

export const VISUALIZATION = {
  /**
   * Maximum distance for displaying labels in 3D space
   */
  MAX_LABEL_DISTANCE: 50,

  /**
   * Animation duration for camera transitions in milliseconds
   */
  CAMERA_ANIMATION_DURATION: 1000,

  /**
   * Minimum node size for instanced rendering
   */
  MIN_NODE_SIZE: 0.5,

  /**
   * Maximum node size for instanced rendering
   */
  MAX_NODE_SIZE: 2.0,

  /**
   * Edge opacity value (0-1)
   */
  EDGE_OPACITY: 0.3,

  /**
   * Number of segments for edge curves
   */
  EDGE_CURVE_SEGMENTS: 32,
} as const;

export const DATABASE = {
  /**
   * Batch size for bulk operations
   */
  BULK_OPERATION_BATCH_SIZE: 100,

  /**
   * Cache expiration time in milliseconds
   */
  CACHE_EXPIRATION_MS: 300000,
} as const;

export const METADATA = {
  /**
   * Minimum number of topics to extract per page
   */
  MIN_TOPICS_PER_PAGE: 2,

  /**
   * Maximum number of topics to extract per page
   */
  MAX_TOPICS_PER_PAGE: 4,

  /**
   * Maximum title length in words
   */
  MAX_TITLE_WORDS: 12,
} as const;
