import { Tensor, matmul } from '@huggingface/transformers';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}

export function mean(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  return result.map(v => v / vectors.length);
}

export function meanVector(vectors: number[][]): number[] {
  const normalized = vectors.map(v => normalize(v));
  return mean(normalized);
}

export function subtract(vec: number[], mean: number[]): number[] {
  return vec.map((v, i) => v - mean[i]);
}

export function covarianceMatrix(centered: number[][]): number[][] {
  const dim = centered[0].length;
  const n = centered.length;
  const cov: number[][] = Array(dim).fill(0).map(() => Array(dim).fill(0));

  for (let i = 0; i < dim; i++) {
    for (let j = i; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      cov[i][j] = cov[j][i] = sum / (n - 1);
    }
  }

  return cov;
}

export function eigenDecomposition(matrix: number[][], numComponents: number): number[][] {
  const n = matrix.length;
  const eigenvectors: number[][] = [];

  for (let comp = 0; comp < Math.min(numComponents, n); comp++) {
    const vec = new Array(n).fill(0);
    vec[comp % n] = 1;

    for (let iter = 0; iter < 100; iter++) {
      let next = new Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          next[i] += matrix[i][j] * vec[j];
        }
      }

      for (const prevEig of eigenvectors) {
        const dot = next.reduce((sum, v, i) => sum + v * prevEig[i], 0);
        for (let i = 0; i < n; i++) {
          next[i] -= dot * prevEig[i];
        }
      }

      const norm = Math.sqrt(next.reduce((sum, v) => sum + v * v, 0));
      next = next.map(v => v / norm);

      const diff = Math.sqrt(vec.reduce((sum, v, i) => sum + (v - next[i]) ** 2, 0));
      vec.splice(0, vec.length, ...next);

      if (diff < 1e-6) break;
    }

    eigenvectors.push(vec);
  }

  return eigenvectors;
}

export function normalize3D(positions: number[][]): number[][] {
  if (positions.length === 0) return [];

  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];

  for (const pos of positions) {
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], pos[i]);
      maxs[i] = Math.max(maxs[i], pos[i]);
    }
  }

  const ranges = maxs.map((max, i) => max - mins[i]);
  const maxRange = Math.max(...ranges);

  if (maxRange === 0) return positions;

  return positions.map(pos =>
    pos.map((v, i) => ((v - mins[i]) / maxRange - 0.5) * 20)
  );
}

export function arrayToArrayBuffer(arr: number[]): ArrayBuffer {
  return new Float32Array(arr).buffer;
}

export function arrayBufferToArray(buf: ArrayBuffer): number[] {
  return Array.from(new Float32Array(buf));
}

export async function computeSimilarity(embeddings: Tensor): Promise<number[][]> {
  const scores = await matmul(embeddings, embeddings.transpose(1, 0));
  return scores.tolist() as number[][];
}

export async function computeSimilarityBatch(embedding: number[], otherEmbeddings: number[][]): Promise<number[]> {
  const allEmbeddings = [embedding, ...otherEmbeddings];
  const tensor = new Tensor('float32', allEmbeddings.flat(), [allEmbeddings.length, embedding.length]);
  const similarityMatrix = await computeSimilarity(tensor);
  return similarityMatrix[0].slice(1);
}

export function findSemanticMedoid(embeddings: number[][], ids: string[]): string {
  if (embeddings.length === 0) throw new Error('Cannot find medoid of empty cluster');
  if (embeddings.length === 1) return ids[0];

  const normalizedEmbeddings = embeddings.map(e => normalize(e));
  const clusterMean = mean(normalizedEmbeddings);

  let maxSimilarity = -Infinity;
  let medoidIndex = 0;

  for (let i = 0; i < normalizedEmbeddings.length; i++) {
    const sim = cosineSimilarity(normalizedEmbeddings[i], clusterMean);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      medoidIndex = i;
    }
  }

  return ids[medoidIndex];
}
