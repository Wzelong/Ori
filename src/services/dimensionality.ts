import { UMAP } from 'umap-js';

interface PCAResult {
  components: number[][];
  mean: number[];
}

function mean(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  return result.map(v => v / vectors.length);
}

function subtract(vec: number[], mean: number[]): number[] {
  return vec.map((v, i) => v - mean[i]);
}

function covarianceMatrix(centered: number[][]): number[][] {
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

function eigenDecomposition(matrix: number[][], numComponents: number): number[][] {
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

export function pca(vectors: number[][], numComponents: number = 100): PCAResult {
  if (vectors.length === 0) {
    throw new Error('Cannot perform PCA on empty dataset');
  }

  const meanVec = mean(vectors);
  const centered = vectors.map(v => subtract(v, meanVec));
  const cov = covarianceMatrix(centered);
  const components = eigenDecomposition(cov, numComponents);

  return { components, mean: meanVec };
}

export function projectPCA(vector: number[], pcaResult: PCAResult): number[] {
  const centered = subtract(vector, pcaResult.mean);
  return pcaResult.components.map(comp =>
    comp.reduce((sum, c, i) => sum + c * centered[i], 0)
  );
}

export function umap(vectors: number[][], nComponents: number = 3): number[][] {
  if (vectors.length === 0) {
    return [];
  }

  const umap = new UMAP({
    nComponents,
    nNeighbors: Math.min(15, Math.floor(vectors.length / 2)),
    minDist: 0.1,
    spread: 1.0
  });

  return umap.fit(vectors);
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

export async function computeTopicPositions(embeddings: number[][]): Promise<number[][]> {
  if (embeddings.length === 0) {
    return [];
  }

  if (embeddings.length < 4) {
    return embeddings.map((_, i) => [i * 5, 0, 0]);
  }

  const pcaResult = pca(embeddings, 100);
  const reduced = embeddings.map(emb => projectPCA(emb, pcaResult));

  const positions3D = umap(reduced, 3);

  return normalize3D(positions3D);
}
