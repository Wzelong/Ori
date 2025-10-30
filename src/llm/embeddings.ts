import { AutoTokenizer, AutoModel, env, Tensor, matmul } from '@huggingface/transformers';

if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('');
}

let tokenizer: any = null;
let model: any = null;

async function ensureModel() {
  if (!model) {
    const model_id = 'onnx-community/embeddinggemma-300m-ONNX';
    tokenizer = await AutoTokenizer.from_pretrained(model_id);
    model = await AutoModel.from_pretrained(model_id, {
      dtype: 'fp32'
    });
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  await ensureModel();

  const prefix = 'task: clustering | query: ';
  const inputs = await tokenizer(prefix + text, { padding: true });

  const { sentence_embedding } = await model(inputs);
  return sentence_embedding.tolist()[0];
}

export async function getEmbeddings(texts: string[]): Promise<Tensor> {
  await ensureModel();

  const prefix = 'task: clustering | query: ';
  const prefixedTexts = texts.map(text => prefix + text);
  const inputs = await tokenizer(prefixedTexts, { padding: true });

  const { sentence_embedding } = await model(inputs);
  return sentence_embedding;
}

export async function computeSimilarity(embeddings: Tensor): Promise<number[][]> {
  const scores = await matmul(embeddings, embeddings.transpose(1, 0));
  return scores.tolist() as number[][];
}
