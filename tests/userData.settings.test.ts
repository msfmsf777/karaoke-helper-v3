import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_OVERLAY_DESIGN_ID,
  createDefaultOverlayTemplatesConfig,
  createLyricsDesign,
  createSetlistDesign,
} from '../shared/overlayTemplates';
import type { UserSettings } from '../electron/userData';

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMock.getPath,
  },
}));

import {
  __resetSettingsPersistenceForTests,
  loadSettingsWithMeta,
  saveSettings,
} from '../electron/userData';

const BACKUP_DIR = 'settings-backups';

let tempRoot: string;

const settingsPath = () => path.join(tempRoot, 'settings.json');
const backupDir = () => path.join(tempRoot, BACKUP_DIR);

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function expectMissing(filePath: string) {
  await expect(fs.access(filePath)).rejects.toThrow();
}

function customSettings(label: string): UserSettings {
  const base = createDefaultOverlayTemplatesConfig();
  const lyricsId = `lyrics-${label}`;
  const setlistId = `setlist-${label}`;
  const lyricsDesign = createLyricsDesign(lyricsId, `Lyrics ${label}`, base.lyricsDesigns[0]);
  const setlistDesign = createSetlistDesign(setlistId, `Setlist ${label}`, base.setlistDesigns[0]);

  return {
    separationQuality: label.includes('high') ? 'high' : 'normal',
    language: 'en',
    overlayTemplates: {
      ...base,
      activeLyricsDesignId: lyricsId,
      activeSetlistDesignId: setlistId,
      lyricsDesigns: [base.lyricsDesigns[0], lyricsDesign],
      setlistDesigns: [base.setlistDesigns[0], setlistDesign],
    },
  };
}

describe('fail-safe settings persistence', () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khelper-settings-'));
    electronMock.getPath.mockReturnValue(tempRoot);
    __resetSettingsPersistenceForTests();
  });

  afterEach(async () => {
    __resetSettingsPersistenceForTests();
    electronMock.getPath.mockReset();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('loads custom v2 overlay templates without replacing them', async () => {
    await writeJson(settingsPath(), customSettings('current'));

    const result = await loadSettingsWithMeta();

    expect(result.status).toBe('ok');
    expect(result.unsafeToAutoPersist).toBe(false);
    expect(result.settings.overlayTemplates?.activeLyricsDesignId).toBe('lyrics-current');
    expect(result.settings.overlayTemplates?.activeSetlistDesignId).toBe('setlist-current');
    expect(result.settings.overlayTemplates?.lyricsDesigns.some((design) => design.id === 'lyrics-current')).toBe(true);
    expect(result.settings.overlayTemplates?.setlistDesigns.some((design) => design.id === 'setlist-current')).toBe(true);
  });

  it('does not create settings when the file is missing', async () => {
    const result = await loadSettingsWithMeta();

    expect(result.status).toBe('missing');
    expect(result.unsafeToAutoPersist).toBe(true);
    expect(result.settings.overlayTemplates?.activeLyricsDesignId).toBe(DEFAULT_OVERLAY_DESIGN_ID);
    await expectMissing(settingsPath());
  });

  it('migrates legacy combined overlay designs into lyrics and setlist designs', async () => {
    await writeJson(settingsPath(), {
      separationQuality: 'normal',
      overlayTemplates: {
        activeDesignId: 'legacy-main',
        designs: [
          {
            id: 'legacy-main',
            name: 'Legacy Main',
            shared: { accentColor: '#21d07a' },
            lyrics: { lineMode: 'fill' },
            setlist: { templateId: 'classic_list' },
          },
        ],
      },
    });

    const result = await loadSettingsWithMeta();

    expect(result.status).toBe('ok');
    expect(result.settings.overlayTemplates?.activeLyricsDesignId).toBe('legacy-main');
    expect(result.settings.overlayTemplates?.activeSetlistDesignId).toBe('legacy-main');
    expect(result.settings.overlayTemplates?.lyricsDesigns.some((design) => design.id === 'legacy-main')).toBe(true);
    expect(result.settings.overlayTemplates?.setlistDesigns.some((design) => design.id === 'legacy-main')).toBe(true);
  });

  it('restores the newest valid backup when settings are corrupt', async () => {
    await fs.mkdir(backupDir(), { recursive: true });
    const oldBackup = path.join(backupDir(), 'settings-pre-save-20260101000000000.json');
    const newBackup = path.join(backupDir(), 'settings-pre-save-20260102000000000.json');
    await writeJson(oldBackup, customSettings('old'));
    await writeJson(newBackup, customSettings('new-high'));
    await fs.utimes(oldBackup, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    await fs.utimes(newBackup, new Date('2026-01-02T00:00:00Z'), new Date('2026-01-02T00:00:00Z'));
    await fs.writeFile(settingsPath(), '{ broken json', 'utf-8');

    const result = await loadSettingsWithMeta();
    const restored = await readJson<UserSettings>(settingsPath());

    expect(result.status).toBe('restored-from-backup');
    expect(result.unsafeToAutoPersist).toBe(false);
    expect(result.backupPath).toBe(newBackup);
    expect(result.quarantinedPath).toBeTruthy();
    await fs.access(result.quarantinedPath!);
    expect(result.settings.overlayTemplates?.activeLyricsDesignId).toBe('lyrics-new-high');
    expect(restored.overlayTemplates?.activeLyricsDesignId).toBe('lyrics-new-high');
  });

  it('preserves corrupt settings and blocks auto-persist when no backup can restore them', async () => {
    const corruptContent = '{ broken json';
    await fs.writeFile(settingsPath(), corruptContent, 'utf-8');

    const result = await loadSettingsWithMeta();

    expect(result.status).toBe('corrupt-defaulted');
    expect(result.unsafeToAutoPersist).toBe(true);
    expect(await fs.readFile(settingsPath(), 'utf-8')).toBe(corruptContent);
    expect(result.quarantinedPath).toBeTruthy();
    expect(await fs.readFile(result.quarantinedPath!, 'utf-8')).toBe(corruptContent);
  });

  it('serializes overlapping saves and keeps the newest settings payload', async () => {
    await writeJson(settingsPath(), customSettings('initial'));

    await Promise.all(
      Array.from({ length: 12 }, (_, index) => saveSettings(customSettings(`queued-${index}`))),
    );

    const saved = await readJson<UserSettings>(settingsPath());
    const files = await fs.readdir(tempRoot);

    expect(saved.overlayTemplates?.activeLyricsDesignId).toBe('lyrics-queued-11');
    expect(saved.overlayTemplates?.activeSetlistDesignId).toBe('setlist-queued-11');
    expect(files.filter((file) => file.includes('.tmp')).length).toBe(0);
  });

  it('bounds settings backups after saves', async () => {
    await writeJson(settingsPath(), customSettings('initial'));
    await fs.mkdir(backupDir(), { recursive: true });
    for (let index = 0; index < 60; index += 1) {
      await writeJson(path.join(backupDir(), `settings-pre-save-202601010000${String(index).padStart(2, '0')}.json`), customSettings(`pre-${index}`));
    }
    for (let index = 0; index < 14; index += 1) {
      await fs.writeFile(path.join(backupDir(), `settings-corrupt-202601010001${String(index).padStart(2, '0')}.json`), '{ broken', 'utf-8');
    }

    await saveSettings(customSettings('after-prune'));

    const backups = await fs.readdir(backupDir());
    expect(backups.filter((file) => file.startsWith('settings-pre-save-')).length).toBeLessThanOrEqual(50);
    expect(backups.filter((file) => file.startsWith('settings-corrupt-')).length).toBeLessThanOrEqual(10);
  });
});
