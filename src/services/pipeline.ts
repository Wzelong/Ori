import { extractPageResult } from './extract';
import { insertPageResult } from './insert';

export async function runPipeline() {
  const pageResult = await extractPageResult();
  console.log('Extracted:', pageResult);

  const item = await insertPageResult(pageResult);
  console.log('Inserted item:', item);

  return pageResult;
}
