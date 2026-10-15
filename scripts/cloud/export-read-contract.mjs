import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { readResponseSchema } from '../../cloud/src/read-contracts.ts';

const target = new URL(
  '../../cloud/contracts/read-v1.schema.json',
  import.meta.url,
);
const generated = z.toJSONSchema(readResponseSchema);
if (process.argv.includes('--check')) {
  const actual = JSON.parse(await readFile(target, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(generated))
    throw new Error('Read contract drift: run npm run cloud:contract:export.');
  console.log('Read contract matches the current metadata schemas.');
} else {
  await writeFile(target, `${JSON.stringify(generated, null, 2)}\n`);
  console.log('Exported cloud/contracts/read-v1.schema.json.');
}
