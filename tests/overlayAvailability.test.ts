import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');

describe('OBS overlay availability regressions', () => {
  it('does not require Electron preload APIs on browser-served overlay pages', () => {
    const source = readSource('src/main.tsx');

    expect(source).toContain('window.ipcRenderer?.on');
    expect(source).not.toContain("window.ipcRenderer.on('main-process-message'");
  });

  it('starts the overlay server from the primary app lifecycle only', () => {
    const source = readSource('electron/main.ts');
    const singleInstanceQuitIndex = source.indexOf('if (!gotTheLock)');
    const serverStartIndex = source.indexOf('startOverlayServer()');
    const rawListenIndex = source.indexOf('server.listen(OVERLAY_PORT');

    expect(source).toContain('function startOverlayServer()');
    expect(serverStartIndex).toBeGreaterThan(singleInstanceQuitIndex);
    expect(rawListenIndex).toBeGreaterThan(source.indexOf('function startOverlayServer()'));
    expect(rawListenIndex).toBeLessThan(source.indexOf('function stopOverlayServer()'));
  });
});
