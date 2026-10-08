import { mkdirSync } from 'node:fs';

// CLI fixture tests need an ignored, project-local root even in a fresh clone.
mkdirSync('.wfcheck', { recursive: true, mode: 0o700 });
