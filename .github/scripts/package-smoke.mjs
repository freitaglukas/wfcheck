import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = mkdtempSync(join(tmpdir(), 'wfcheck-package-smoke-'));
const consumer = join(root, 'consumer');
mkdirSync(consumer);
const environment = { ...process.env, N8N_BASE_URL: '', N8N_API_KEY: '' };

try {
  const packages = Object.values(JSON.parse(execFileSync('npm', [
    'pack', '--json', '--ignore-scripts', '--pack-destination', root,
  ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })));
  assert.equal(packages.length, 1);
  const [packed] = packages;
  assert(packed.files.some(file => file.path === 'dist/cli/main.js'));
  assert(packed.files.filter(file=>file.path.startsWith('examples/')).every(file=>/^examples\/(fixtures|suites|workflows)\/[^/]+$/.test(file.path)));
  assert(!packed.files.some(file => /^(?:\.env$|\.wfcheck\/|artifacts\/)/.test(file.path)));
  execFileSync('npm', [
    'install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund',
    '--prefix', consumer, join(root, packed.filename),
  ], { stdio: 'pipe', timeout: 120_000 });
  const cli = join(consumer, 'node_modules/wfcheck-local-alpha/dist/cli/main.js');
  const run = (args, expectedExit = 0) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: consumer, env: environment, encoding: 'utf8', timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, expectedExit, result.stdout + result.stderr);
    return result;
  };
  assert.equal(run(['--version']).stdout.trim(), packed.version);
  run(['init', 'project']);
  const source = 'project/examples/workflows/correct.json';
  const inventory = JSON.parse(run(['inspect', source]).stdout);
  assert.equal(inventory.sourceHash, createHash('sha256')
    .update(readFileSync(join(consumer, source))).digest('hex'));
  assert(inventory.nodes.length > 0);
  run(['plan', source, '--out', 'project/tests/draft.yaml'], 2);
  const rejected = run(['run', 'project/tests/draft.yaml', '--runtime', 'docker'], 2);
  assert.match(rejected.stdout, /Planned n8n executions: 0/);
  assert.match(rejected.stderr, /draft/i);
  console.log('Installed package smoke passed: version, init, inspect, plan, draft rejection; zero executions.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
