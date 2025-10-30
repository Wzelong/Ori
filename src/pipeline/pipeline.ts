import { extractPageResult } from './extract';

export async function runPipeline() {
  const result = await extractPageResult();
  console.log('Pipeline result:', result);
  return result;
}
