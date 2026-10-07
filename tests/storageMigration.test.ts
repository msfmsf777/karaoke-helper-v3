import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tempRoot),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  shell: {
    openPath: vi.fn(),
  },
}));

let tempRoot: string;
let defaultSongsDir: string;
let customTargetDir: string;

describe('storage migration and path self-healing', () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khelper-storage-test-'));
    defaultSongsDir = path.join(tempRoot, 'KHelperLive', 'songs');
    customTargetDir = path.join(tempRoot, 'CustomSongs');
    await fs.mkdir(defaultSongsDir, { recursive: true });
    await fs.mkdir(customTargetDir, { recursive: true });
  });

  afterEach(async () => {
    vi.resetModules();
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('prevents preflight when target is the same directory', async () => {
    const { migrationManager } = await import('../electron/migrationManager');
    const { setCustomSongsDir } = await import('../electron/songLibrary');
    setCustomSongsDir(null);

    const result = await migrationManager.preflightCheck(defaultSongsDir);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('same as the current');
  });

  it('prevents preflight when target is a nested subfolder', async () => {
    const { migrationManager } = await import('../electron/migrationManager');
    const { setCustomSongsDir } = await import('../electron/songLibrary');
    setCustomSongsDir(null);

    const nested = path.join(defaultSongsDir, 'subfolder');
    const result = await migrationManager.preflightCheck(nested);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('nested');
  });

  it('migrates songs, rewrites meta.json paths, and updates active songs directory', async () => {
    const { migrationManager } = await import('../electron/migrationManager');
    const { setCustomSongsDir, getSongsDir, getSeparatedSongPaths } = await import('../electron/songLibrary');
    setCustomSongsDir(null);

    // Create a mock song in defaultSongsDir
    const songId = '12345';
    const songFolder = path.join(defaultSongsDir, songId);
    await fs.mkdir(songFolder, { recursive: true });

    const originalAudioPath = path.join(songFolder, 'Original.mp3');
    const instrPath = path.join(songFolder, 'Instrumental.mp3');
    const vocalPath = path.join(songFolder, 'Vocals.mp3');
    await fs.writeFile(originalAudioPath, 'dummy-audio');
    await fs.writeFile(instrPath, 'dummy-instr');
    await fs.writeFile(vocalPath, 'dummy-vocal');

    const meta = {
      id: songId,
      title: 'Test Song',
      type: '原曲',
      audio_status: 'separated',
      stored_filename: 'Original.mp3',
      instrumental_path: instrPath,
      vocal_path: vocalPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await fs.writeFile(path.join(songFolder, 'meta.json'), JSON.stringify(meta, null, 2));

    // Run migration to customTargetDir
    await migrationManager.startMigration(customTargetDir, 'move');

    // Verify active songs dir changed
    expect(path.resolve(getSongsDir())).toBe(path.resolve(customTargetDir));

    // Verify files copied to target
    const targetSongFolder = path.join(customTargetDir, songId);
    const targetMetaRaw = await fs.readFile(path.join(targetSongFolder, 'meta.json'), 'utf-8');
    const targetMeta = JSON.parse(targetMetaRaw);

    expect(targetMeta.instrumental_path).toBe(path.join(targetSongFolder, 'Instrumental.mp3'));
    expect(targetMeta.vocal_path).toBe(path.join(targetSongFolder, 'Vocals.mp3'));

    // Verify getSeparatedSongPaths resolves target paths seamlessly
    const resolved = await getSeparatedSongPaths(songId);
    expect(resolved.instrumental).toBe(path.join(targetSongFolder, 'Instrumental.mp3'));
    expect(resolved.vocal).toBe(path.join(targetSongFolder, 'Vocals.mp3'));
  });

  it('switches library directly, updates active songs directory, and notifies subscribers', async () => {
    const { migrationManager } = await import('../electron/migrationManager');
    const { setCustomSongsDir, getSongsDir } = await import('../electron/songLibrary');
    setCustomSongsDir(null);

    // Create an existing song library in customTargetDir
    const songId = 'switch-123';
    const targetSongFolder = path.join(customTargetDir, songId);
    await fs.mkdir(targetSongFolder, { recursive: true });
    await fs.writeFile(
      path.join(targetSongFolder, 'meta.json'),
      JSON.stringify({
        id: songId,
        title: 'Existing Song',
        type: '原曲',
        audio_status: 'original',
        stored_filename: 'Original.mp3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );

    let notifiedCompleted = false;
    const unsub = migrationManager.subscribe((p) => {
      if (p.status === 'completed') {
        notifiedCompleted = true;
      }
    });

    const result = await migrationManager.startMigration(customTargetDir, 'switch');
    unsub();

    expect(result.status).toBe('completed');
    expect(notifiedCompleted).toBe(true);
    expect(path.resolve(getSongsDir())).toBe(path.resolve(customTargetDir));
  });

  it('self-heals stem paths if meta.json has broken paths but files exist in song folder', async () => {
    const { setCustomSongsDir, getSeparatedSongPaths } = await import('../electron/songLibrary');
    setCustomSongsDir(customTargetDir);

    const songId = 'healer-99';
    const songFolder = path.join(customTargetDir, songId);
    await fs.mkdir(songFolder, { recursive: true });

    await fs.writeFile(path.join(songFolder, 'Original.mp3'), 'audio');
    await fs.writeFile(path.join(songFolder, 'Instrumental.mp3'), 'instr');
    await fs.writeFile(path.join(songFolder, 'Vocals.mp3'), 'vocal');

    // Broken paths pointing to non-existent drive Z:
    const meta = {
      id: songId,
      title: 'Broken Paths Song',
      type: '原曲',
      audio_status: 'separated',
      stored_filename: 'Original.mp3',
      instrumental_path: 'Z:\\OldLocation\\Instrumental.mp3',
      vocal_path: 'Z:\\OldLocation\\Vocals.mp3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await fs.writeFile(path.join(songFolder, 'meta.json'), JSON.stringify(meta, null, 2));

    // getSeparatedSongPaths should detect the broken paths and self-heal by finding them in songFolder
    const resolved = await getSeparatedSongPaths(songId);
    expect(resolved.instrumental).toBe(path.join(songFolder, 'Instrumental.mp3'));
    expect(resolved.vocal).toBe(path.join(songFolder, 'Vocals.mp3'));
  });

  it('cleans old song folder safely with validation checks', async () => {
    const { migrationManager } = await import('../electron/migrationManager');
    const { setCustomSongsDir } = await import('../electron/songLibrary');

    // Active directory is customTargetDir
    setCustomSongsDir(customTargetDir);

    const oldFolder = path.join(tempRoot, 'OldSongsToClean');
    await fs.mkdir(path.join(oldFolder, 'song1'), { recursive: true });
    await fs.writeFile(path.join(oldFolder, 'song1', 'meta.json'), '{}');

    // 1. Refuses to clean active songs directory
    const refusedActive = await migrationManager.cleanOldAppDataFolder(customTargetDir);
    expect(refusedActive.success).toBe(false);
    expect(refusedActive.error).toContain('currently active');

    // 2. Refuses to clean system root or userData
    const refusedUserData = await migrationManager.cleanOldAppDataFolder(tempRoot);
    expect(refusedUserData.success).toBe(false);
    expect(refusedUserData.error).toContain('protected system');

    // 3. Successfully cleans old folder
    const result = await migrationManager.cleanOldAppDataFolder(oldFolder);
    expect(result.success).toBe(true);

    // Directory should no longer exist
    let exists = true;
    try {
      await fs.access(oldFolder);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});
