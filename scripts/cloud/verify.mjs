import { readFile } from 'node:fs/promises';

async function main() {
  const api = new URL(process.argv[2] ?? '');
  const local =
    api.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(api.hostname);
  if (
    (!local &&
      (api.protocol !== 'https:' || !api.hostname.endsWith('.workers.dev'))) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname !== '/'
  )
    throw new Error(
      'Provide the Worker origin: npm run cloud:verify -- https://your-worker.workers.dev',
    );
  const credentials = JSON.parse(
    await readFile(
      new URL('../../cloud/credentials.local.json', import.meta.url),
      'utf8',
    ),
  );
  const request = async (path, token, method = 'GET', body) =>
    fetch(new URL(path, api), {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  if ((await request('/v1/projects')).status !== 401)
    throw new Error('Unauthenticated access was not rejected.');
  const publisher = await request(
    '/v1/sync/status',
    credentials.publisherToken,
  );
  if (!publisher.ok)
    throw new Error(
      `Publisher verification failed with HTTP ${publisher.status}.`,
    );
  const status = await publisher.json();
  if (
    status.protocolVersion !== 1 ||
    status.workspaceId !== credentials.workspaceId ||
    status.deviceId !== credentials.deviceId
  )
    throw new Error(
      'The Worker workspace/device configuration does not match the setup file.',
    );
  const reader = await request('/v1/projects', credentials.readerToken);
  if (!reader.ok)
    throw new Error(`Reader verification failed with HTTP ${reader.status}.`);
  const projects = await reader.json();
  if (projects.protocolVersion !== 1 || !Array.isArray(projects.items))
    throw new Error('The cloud read response is invalid.');
  if (
    (await request('/v1/sync/snapshots', credentials.readerToken, 'POST', {}))
      .status !== 403
  )
    throw new Error('Read-only publication was not rejected.');
  console.log(
    'PASS: missing credentials rejected; publisher workspace verified; reader access verified; reader publication rejected.',
  );
  console.log(
    `Projects visible on the first page: ${projects.items.length}. No record contents or tokens were printed.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
