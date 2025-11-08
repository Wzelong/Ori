import { AutoTokenizer, AutoModel, env, Tensor } from '@huggingface/transformers';
import { arrayToArrayBuffer, arrayBufferToArray } from '../services/vectorUtils';

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

export async function getEmbedding(
  text: string,
  format: 'query' | 'doc' = 'query',
  title?: string
): Promise<number[]> {
  await ensureModel();

  let prefix: string;
  if (format === 'query') {
    prefix = 'task: search result | query: ';
  } else if (title) {
    prefix = `title: ${title} | text: `;
  } else {
    prefix = 'title: none | text: ';
  }

  const inputs = await tokenizer(prefix + text, { padding: true });

  const { sentence_embedding } = await model(inputs);
  return sentence_embedding.tolist()[0];
}

export async function getEmbeddings(
  texts: string[],
  format: 'query' | 'doc' = 'doc'
): Promise<Tensor> {
  await ensureModel();

  const prefix = format === 'query'
    ? 'task: search result | query: '
    : 'title: none | text: ';

  const prefixedTexts = texts.map(text => prefix + text);
  const inputs = await tokenizer(prefixedTexts, { padding: true });

  const { sentence_embedding } = await model(inputs);
  return sentence_embedding;
}

export async function storeVector(
  db: any,
  ownerType: 'item' | 'topic',
  ownerId: string,
  embedding: number[]
) {
  await db.vectors.put({
    ownerType,
    ownerId,
    buf: arrayToArrayBuffer(embedding),
    createdAt: Date.now()
  });
}

export async function loadVector(
  db: any,
  ownerType: 'item' | 'topic',
  ownerId: string
): Promise<number[] | null> {
  const row = await db.vectors.get([ownerType, ownerId]);
  return row ? arrayBufferToArray(row.buf) : null;
}
