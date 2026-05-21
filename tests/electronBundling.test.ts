import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Electron main bundling', () => {
  it('externalizes ws so optional native peer dependencies stay optional', () => {
    const viteConfig = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf-8');

    expect(viteConfig).toContain("external: ['yt-search', 'ws', 'bufferutil', 'utf-8-validate']");
  });
});
