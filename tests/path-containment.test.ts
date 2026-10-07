import {it,expect} from 'vitest';
import {posix,win32} from 'node:path';
import {isWithinDirectory} from '../src/spec/load.js';
it('rejects Windows drive and UNC escapes but permits descendants',()=>{
 expect(isWithinDirectory('C:\\project','D:\\private\\fixture.json',win32)).toBe(false);
 expect(isWithinDirectory('C:\\project','C:\\outside\\fixture.json',win32)).toBe(false);
 expect(isWithinDirectory('\\\\server1\\share\\project','\\\\server2\\share\\private.json',win32)).toBe(false);
 expect(isWithinDirectory('C:\\project','C:\\project\\fixtures\\input.json',win32)).toBe(true);
});
it('rejects POSIX parent and sibling paths while permitting descendants',()=>{
 expect(isWithinDirectory('/project','/private/fixture.json',posix)).toBe(false);
 expect(isWithinDirectory('/project','/project-other/fixture.json',posix)).toBe(false);
 expect(isWithinDirectory('/project','/project/fixtures/input.json',posix)).toBe(true);
});
