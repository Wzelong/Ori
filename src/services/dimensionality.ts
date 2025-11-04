import { UMAP } from 'umap-js';
import { mean, subtract, covarianceMatrix, eigenDecomposition, normalize3D } from './vectorUtils';
import { getSettings } from './settings';

interface PCAResult {
  components: number[][];
  mean: number[];
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

export function umap(
  vectors: number[][],
  nComponents: number = 3,
  minDist: number = 0.4,
  spread: number = 2.0
): number[][] {
  if (vectors.length === 0) {
    return [];
  }

  const umap = new UMAP({
    nComponents,
    nNeighbors: Math.min(15, Math.floor(vectors.length / 2)),
    minDist,
    spread
  });

  return umap.fit(vectors);
}

export async function computeTopicPositions(embeddings: number[][]): Promise<number[][]> {
  if (embeddings.length === 0) {
    return [];
  }

  if (embeddings.length < 4) {
    return embeddings.map((_, i) => [i * 5, 0, 0]);
  }

  const settings = await getSettings();

  const pcaResult = pca(embeddings, 100);
  const reduced = embeddings.map(emb => projectPCA(emb, pcaResult));

  const positions3D = umap(
    reduced,
    3,
    settings.graph.umapMinDist,
    settings.graph.umapSpread
  );

  return normalize3D(positions3D);
}
