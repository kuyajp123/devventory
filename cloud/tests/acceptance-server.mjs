// A disposable, synthetic-only HTTP/D1 target for the Rust integration test.
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const bundle = await build({
  entryPoints: [
    new URL('../src/worker.ts', import.meta.url).pathname.replace(
      /^\/(\w:)/,
      '$1',
    ),
  ],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-06-11',
    cf: false,
    d1Databases: ['DB'],
    host: '127.0.0.1',
    port: 0,
    ratelimits: {
      SYNC_RATE_LIMITER: {
        namespace_id: '1001',
        simple: { limit: 10000, period: 60 },
      },
    },
    bindings: {
      SYNC_WORKSPACE_ID: '11111111-1111-4111-8111-111111111111',
      SYNC_PUBLISHER_DEVICE_ID: '22222222-2222-4222-8222-222222222222',
      SYNC_PUBLISHER_TOKEN_HASH: hash('a'.repeat(64)),
      SYNC_READER_TOKEN_HASH: hash('b'.repeat(64)),
    },
  }),
);
const database = await runtime.getD1Database('DB');
const directory = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(directory))
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const migration = await readFile(new URL(file, directory), 'utf8');
  for (const statement of migration
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean))
    await database.prepare(statement).run();
}
console.log(JSON.stringify({ url: (await runtime.ready).origin }));
process.stdin.resume();
process.stdin.on(
  'end',
  () => void runtime.dispose().then(() => process.exit(0)),
);
