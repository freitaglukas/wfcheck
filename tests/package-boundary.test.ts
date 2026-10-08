import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

it('packages only generic examples, not application deployment code', () => {
  // npm 11 returns an array; npm 12 keys the same metadata by package name.
  const packed = Object.values(JSON.parse(execFileSync('npm', ['pack','--dry-run','--json','--ignore-scripts'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}))) as Array<{files:Array<{path:string}>}>;
  expect(packed).toHaveLength(1);
  expect(packed[0].files.some((file:{path:string})=>file.path==='docker/runtime-package-lock.json')).toBe(true);
  expect(packed[0].files.filter(file=>file.path.startsWith('examples/')).every(file=>/^examples\/(fixtures|suites|workflows)\/[^/]+$/.test(file.path))).toBe(true);
});
