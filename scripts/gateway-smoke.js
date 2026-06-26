#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const evidenceDir = path.join(repoRoot, '.omo', 'evidence');
const evidenceJsonPath = path.join(evidenceDir, 'task-8-gateway-smoke.json');
const evidenceLogPath = path.join(evidenceDir, 'task-8-architecture-boundaries-fix-plan.log');
const project = process.env.GATEWAY_SMOKE_PROJECT || 'breezy_arch_smoke';
const gatewayHostPort = process.env.API_GATEWAY_PORT || process.env.GATEWAY_SMOKE_PORT || '3100';
process.env.API_GATEWAY_PORT = gatewayHostPort;
const baseUrl = process.env.GATEWAY_SMOKE_BASE_URL || `http://localhost:${gatewayHostPort}`;
const startedAt = new Date().toISOString();
const routes = [];
const commands = [];
const cleanup = [];
let overallPass = false;

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(evidenceLogPath, `Gateway smoke started ${startedAt}\n`);

const appendLog = (message = '') => {
  fs.appendFileSync(evidenceLogPath, `${message}\n`);
};

const dockerCompose = (...args) => ['docker', ['compose', '-p', project, ...args]];

const runCommand = (label, command, args, options = {}) => {
  appendLog(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    ...options,
  });
  const entry = {
    label,
    command: `${command} ${args.join(' ')}`,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    pass: result.status === 0,
  };
  commands.push(entry);
  if (entry.stdout) appendLog(entry.stdout.trimEnd());
  if (entry.stderr) appendLog(entry.stderr.trimEnd());
  appendLog(`exit ${entry.status ?? `signal ${entry.signal}`}`);
  return entry;
};

const runCompose = (label, ...args) => {
  const [command, commandArgs] = dockerCompose(...args);
  return runCommand(label, command, commandArgs);
};

const runDocker = (label, ...args) => runCommand(label, 'docker', args);

const writeEvidence = (extra = {}) => {
  const evidence = {
    event: 'gateway-smoke',
    plan: '.omo/plans/architecture-boundaries-fix-plan.md',
    task: 8,
    project,
    gatewayHostPort,
    baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    pass: overallPass,
    routes,
    commands,
    cleanup,
    artifacts: {
      json: path.relative(repoRoot, evidenceJsonPath),
      log: path.relative(repoRoot, evidenceLogPath),
    },
    ...extra,
  };
  fs.writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBody = async (response) => {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (contentType.includes('application/json') && text) {
    try {
      return { text, json: JSON.parse(text) };
    } catch {
      return { text };
    }
  }
  return { text };
};

const recordRoute = async (name, method, urlPath, options, expect) => {
  const started = Date.now();
  let response;
  let body = { text: '' };
  let error;
  try {
    response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      redirect: 'manual',
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers ?? {}),
      },
    });
    body = await parseBody(response);
  } catch (err) {
    error = err.message;
  }

  const status = response?.status ?? 0;
  const pass = expect({ status, body, headers: response?.headers, error });
  const entry = {
    name,
    method,
    path: urlPath,
    status,
    pass,
    critical: true,
    durationMs: Date.now() - started,
    response: body.json ?? body.text.slice(0, 1200),
    error,
  };
  routes.push(entry);
  appendLog(`${pass ? 'PASS' : 'FAIL'} ${method} ${urlPath} -> ${status}`);
  if (!pass) {
    appendLog(JSON.stringify(entry, null, 2));
  }
  return { entry, body, status };
};

const expectStatus =
  (...statuses) =>
  ({ status, error }) =>
    !error && statuses.includes(status);

const waitForGateway = async () => {
  const deadline = Date.now() + Number(process.env.GATEWAY_SMOKE_READY_TIMEOUT_MS ?? 120000);
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const result = await recordRoute(
      `gateway readiness attempt ${attempt}`,
      'GET',
      '/health',
      {},
      expectStatus(200)
    );
    if (result.entry.pass) return;
    result.entry.critical = false;
    await sleep(2000);
  }
  throw new Error('Gateway /health did not become ready before timeout');
};

const retryStep = async (description, action) => {
  const deadline = Date.now() + 60000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      appendLog(`${description} retry: ${err.message}`);
      await sleep(2500);
    }
  }
  throw lastError ?? new Error(`${description} failed`);
};

const assertRoute = (result, message) => {
  if (!result.entry.pass) {
    throw new Error(message);
  }
  return result.body.json;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const registerAndLogin = async (suffix, runId) => {
  const payload = {
    username: `smoke_${suffix}_${runId}`.slice(0, 50),
    email: `smoke.${suffix}.${runId}@example.com`,
    password: 'Password123',
  };
  const registerResult = await recordRoute(
    `auth register ${suffix}`,
    'POST',
    '/api/v1/auth/register',
    { body: JSON.stringify(payload) },
    expectStatus(201)
  );
  const registered = assertRoute(registerResult, `Register ${suffix} failed`);
  const loginResult = await recordRoute(
    `auth login ${suffix}`,
    'POST',
    '/api/v1/auth/login',
    { body: JSON.stringify({ email: payload.email, password: payload.password }) },
    expectStatus(200)
  );
  const loggedIn = assertRoute(loginResult, `Login ${suffix} failed`);
  return {
    payload,
    token: loggedIn.token,
    user: loggedIn.user ?? registered.user,
  };
};

const runHttpSmoke = async () => {
  await waitForGateway();
  const runId = `${Date.now()}_${process.pid}`;
  const author = await retryStep('auth-service readiness', () => registerAndLogin('author', runId));
  const reader = await registerAndLogin('reader', runId);

  const profileUpdate = await recordRoute(
    'profile update own profile',
    'PUT',
    '/api/v1/users/me',
    {
      headers: bearer(author.token),
      body: JSON.stringify({
        bio: 'Gateway smoke profile',
        avatarUrl: 'https://example.com/breezy-smoke.png',
      }),
    },
    expectStatus(200)
  );
  assertRoute(profileUpdate, 'Profile update failed');

  const profileRead = await recordRoute(
    'profile public read',
    'GET',
    `/api/v1/users/${author.user.id}`,
    {},
    ({ status, body, error }) =>
      !error && status === 200 && body.json?.avatarUrl === 'https://example.com/breezy-smoke.png'
  );
  assertRoute(profileRead, 'Profile read failed');

  const postCreate = await recordRoute(
    'post creation',
    'POST',
    '/api/v1/posts',
    {
      headers: bearer(author.token),
      body: JSON.stringify({ content: `Gateway smoke post ${runId}` }),
    },
    expectStatus(201)
  );
  const post = assertRoute(postCreate, 'Post creation failed');

  const commentCreate = await recordRoute(
    'comment creation',
    'POST',
    `/api/v1/posts/${post.id}/comments`,
    {
      headers: bearer(reader.token),
      body: JSON.stringify({ content: `Gateway smoke comment ${runId}` }),
    },
    expectStatus(201)
  );
  assertRoute(commentCreate, 'Comment creation failed');

  const commentsRead = await recordRoute(
    'comments read',
    'GET',
    `/api/v1/posts/${post.id}/comments`,
    {},
    ({ status, body, error }) => !error && status === 200 && Array.isArray(body.json)
  );
  assertRoute(commentsRead, 'Comments read failed');

  const follow = await recordRoute(
    'follow author',
    'POST',
    `/api/v1/users/${author.user.id}/follow`,
    { headers: bearer(reader.token) },
    expectStatus(200)
  );
  assertRoute(follow, 'Follow failed');

  const following = await recordRoute(
    'following read',
    'GET',
    `/api/v1/users/${reader.user.id}/following`,
    {},
    ({ status, body, error }) => !error && status === 200 && Array.isArray(body.json)
  );
  assertRoute(following, 'Following read failed');

  const feed = await recordRoute(
    'feed read',
    'GET',
    '/api/v1/feed?limit=10',
    { headers: bearer(reader.token) },
    ({ status, body, error }) =>
      !error &&
      status === 200 &&
      Array.isArray(body.json) &&
      body.json.some((item) => item.id === post.id)
  );
  assertRoute(feed, 'Feed read failed');

  const docs = await recordRoute(
    'api docs',
    'GET',
    '/api-docs',
    {},
    ({ status, body, error }) =>
      !error &&
      (status === 200 || status === 301 || status === 302) &&
      String(body.text ?? '').length >= 0
  );
  assertRoute(docs, 'API docs route failed');

  const missing = await recordRoute(
    'missing gateway path',
    'GET',
    '/api/v1/does-not-exist',
    {},
    expectStatus(404)
  );
  assertRoute(missing, 'Missing route did not return 404');
};

const main = async () => {
  try {
    const config = runCompose('compose config', 'config', '--quiet');
    if (!config.pass) throw new Error('docker compose config --quiet failed');

    runCompose('pre-clean stale smoke containers', 'down', '--remove-orphans');

    const up = runCompose('compose up', 'up', '-d', '--build');
    if (!up.pass) throw new Error('docker compose up -d --build failed');

    await sleep(5000);
    await runHttpSmoke();
    overallPass = routes.filter((route) => route.critical !== false).every((route) => route.pass);
    if (!overallPass) throw new Error('One or more gateway routes failed');
  } finally {
    const logs = runCompose('compose logs', 'logs', '--no-color', '--tail', '200');
    cleanup.push({ action: 'logs-captured', pass: logs.pass });

    const down = runCompose('compose down', 'down', '--remove-orphans');
    cleanup.push({ action: 'down --remove-orphans', pass: down.pass });

    const ps = runDocker(
      'post-clean docker ps',
      'ps',
      '--filter',
      `name=${project}`,
      '--format',
      '{{.Names}}'
    );
    cleanup.push({
      action: 'docker ps empty check',
      output: ps.stdout.trim(),
      pass: ps.pass && ps.stdout.trim() === '',
    });

    if (cleanup.some((item) => item.pass === false)) {
      overallPass = false;
    }
    writeEvidence();
  }

  if (!overallPass) {
    process.exitCode = 1;
  }
};

main().catch((err) => {
  appendLog(`ERROR ${err.stack ?? err.message}`);
  writeEvidence({ error: err.message });
  process.exitCode = 1;
});
