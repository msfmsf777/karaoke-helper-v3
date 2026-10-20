import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
  getGPUInfo: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMock.getPath,
    getGPUInfo: electronMock.getGPUInfo,
  },
}));

import {
  buildPipBootstrapArgs,
  getCudaWheelProfile,
  separationEnvManager,
} from '../electron/separationEnvManager';
import { classifyNvidiaGpuArchitecture, parseNvidiaDriverVersion } from '../electron/gpuDetector';

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

describe('classifyNvidiaGpuArchitecture & CUDA wheel profiles', () => {
  it('classifies RTX 50-series (Blackwell sm_120) as cu128 and isBlackwell=true', () => {
    expect(classifyNvidiaGpuArchitecture('NVIDIA GeForce RTX 5080 Laptop GPU')).toEqual({
      supported: true,
      cudaIndex: 'cu128',
      isBlackwell: true,
    });
    expect(classifyNvidiaGpuArchitecture('NVIDIA GeForce RTX 5090')).toEqual({
      supported: true,
      cudaIndex: 'cu128',
      isBlackwell: true,
    });
  });

  it('classifies Turing, Ampere, and Ada GPUs (GTX 16, RTX 20/30/40) as cu128', () => {
    for (const model of [
      'NVIDIA GeForce GTX 1660 SUPER',
      'NVIDIA GeForce RTX 2070',
      'NVIDIA GeForce RTX 3060 Laptop GPU',
      'NVIDIA GeForce RTX 4070 Ti',
    ]) {
      expect(classifyNvidiaGpuArchitecture(model)).toEqual({
        supported: true,
        cudaIndex: 'cu128',
        isBlackwell: false,
      });
    }
  });

  it('classifies legacy Maxwell and Pascal GPUs (GTX 750, 900, 10-series) as cu126', () => {
    for (const model of [
      'NVIDIA GeForce GTX 750 Ti',
      'NVIDIA GeForce GTX 970',
      'NVIDIA GeForce GTX 1060 6GB',
      'NVIDIA GeForce GTX 1080 Ti',
      'NVIDIA Quadro P2000',
    ]) {
      expect(classifyNvidiaGpuArchitecture(model)).toEqual({
        supported: true,
        cudaIndex: 'cu126',
        isBlackwell: false,
      });
    }
  });

  it('marks pre-Maxwell GPUs (Kepler / Fermi) as unsupported', () => {
    for (const model of [
      'NVIDIA GeForce GT 710',
      'NVIDIA GeForce GT 730',
      'NVIDIA GeForce GTX 660',
      'NVIDIA GeForce GTX 760',
      'NVIDIA GeForce GTX 780 Ti',
      'NVIDIA GeForce 920M',
    ]) {
      expect(classifyNvidiaGpuArchitecture(model).supported).toBe(false);
    }
  });

  it('returns pinned PyTorch versions for cu128 and cu126 to prevent PyPI CPU wheel clobbering', () => {
    const cu128 = getCudaWheelProfile('cu128');
    expect(cu128.indexUrl).toBe('https://download.pytorch.org/whl/cu128');
    expect(cu128.packages).toEqual([
      'torch==2.11.0+cu128',
      'torchvision==0.26.0+cu128',
      'torchaudio==2.11.0+cu128',
    ]);

    const cu126 = getCudaWheelProfile('cu126');
    expect(cu126.indexUrl).toBe('https://download.pytorch.org/whl/cu126');
    expect(cu126.packages).toEqual([
      'torch==2.14.1+cu126',
      'torchvision==0.29.1+cu126',
      'torchaudio==2.11.0+cu126',
    ]);
  });

  it('constructs pip bootstrap args that inject site-packages via site.addsitedir', () => {
    const packagesDir = 'C:\\Runtime\\Lib\\site-packages';
    const args = buildPipBootstrapArgs(packagesDir, [
      '-m',
      'pip',
      'install',
      '--prefix',
      'C:\\Runtime',
      'audio-separator[gpu]',
    ]);
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain('site.addsitedir(sys.argv[1])');
    expect(args[2]).toBe(packagesDir);
    expect(args.slice(3)).toEqual(['install', '--prefix', 'C:\\Runtime', 'audio-separator[gpu]']);
  });

  it('parses direct and WMI NVIDIA driver versions accurately', () => {
    expect(parseNvidiaDriverVersion('595.79')).toBeCloseTo(595.79);
    expect(parseNvidiaDriverVersion('32.0.15.7216')).toBeCloseTo(572.16);
  });
});
