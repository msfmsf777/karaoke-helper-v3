import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMock.getPath,
  },
}));

import { separationEnvManager } from '../electron/separationEnvManager';

describe('separationEnvManager preflightTargetFolder', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khelper-sep-test-'));
    electronMock.getPath.mockReturnValue(tempRoot);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('rejects identical directory when forMigration is true', async () => {
    const currentDir = separationEnvManager.getSeparationEnvDir();
    await fs.mkdir(currentDir, { recursive: true });

    const result = await separationEnvManager.preflightTargetFolder(currentDir, { forMigration: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('目標目錄不可與目前目錄相同');
  });

  it('allows identical directory when forMigration is false or omitted (for installation/setup)', async () => {
    const currentDir = separationEnvManager.getSeparationEnvDir();
    await fs.mkdir(currentDir, { recursive: true });

    const result = await separationEnvManager.preflightTargetFolder(currentDir, { forMigration: false });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();

    // Also when options are omitted
    const resultDefault = await separationEnvManager.preflightTargetFolder(currentDir);
    expect(resultDefault.valid).toBe(true);
  });

  it('allows custom folder for installation even if cachedCustomRuntimePath matches it', async () => {
    const customDir = path.join(tempRoot, 'my-custom-runtime');
    await fs.mkdir(customDir, { recursive: true });
    separationEnvManager.setCustomRuntimePath(customDir);

    const result = await separationEnvManager.preflightTargetFolder(customDir, { forMigration: false });
    expect(result.valid).toBe(true);
  });
});
