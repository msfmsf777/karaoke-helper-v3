import { BrowserWindow } from 'electron';
import { loadAllSongs, analyzeSongVocalRange, getSongMeta } from './songLibrary';
import { isSeparationRunning } from './separationJobs';

class VocalRangeAutoQueue {
  private isProcessing = false;
  private queue: string[] = [];
  private initialDelayTimeout: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  /**
   * Start the background queue with an initial buffer to avoid startup contention
   */
  public start(delayMs: number = 8000) {
    if (this.initialDelayTimeout) return;
    this.initialDelayTimeout = setTimeout(() => {
      this.initialDelayTimeout = null;
      void this.scanAndQueue();
      // Periodically check every 60 seconds for newly added or unanalyzed songs
      this.checkInterval = setInterval(() => {
        void this.scanAndQueue();
      }, 60000);
    }, delayMs);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.initialDelayTimeout) clearTimeout(this.initialDelayTimeout);
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.queue = [];
  }

  /**
   * Scan library for songs with separated vocal tracks but missing v2 vocal range
   */
  public async scanAndQueue() {
    if (this.isDestroyed) return;
    try {
      const allSongs = await loadAllSongs();
      for (const song of allSongs) {
        if (this.isDestroyed) break;
        const isSeparated = song.audio_status === 'separated' || Boolean(song.vocal_path);
        const hasV2 = song.vocal_range && (song.vocal_range.analysisVersion ?? 1) >= 2;
        if (isSeparated && !hasV2) {
          if (!this.queue.includes(song.id)) {
            this.queue.push(song.id);
          }
        }
      }
      this.processNext();
    } catch (err) {
      console.warn('[VocalRangeQueue] Error scanning library:', err);
    }
  }

  /**
   * Manually queue a specific song (e.g. immediately after separation finishes)
   */
  public queueSong(songId: string) {
    if (!this.queue.includes(songId)) {
      this.queue.push(songId);
    }
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.isDestroyed || this.queue.length === 0) return;

    // Check if heavy stem separation is actively running on CPU/GPU
    if (isSeparationRunning()) {
      // Yield and retry in 5 seconds
      setTimeout(() => this.processNext(), 5000);
      return;
    }

    const nextId = this.queue.shift();
    if (!nextId) return;

    this.isProcessing = true;

    try {
      // Verify song still exists and still needs analysis
      const meta = await getSongMeta(nextId);
      const isSeparated = meta && (meta.audio_status === 'separated' || Boolean(meta.vocal_path));
      const hasV2 = meta?.vocal_range && (meta.vocal_range.analysisVersion ?? 1) >= 2;

      if (isSeparated && !hasV2) {
        console.log(`[VocalRangeQueue] Auto-analyzing song in background: ${nextId} (${meta.title})`);
        const updated = await analyzeSongVocalRange(nextId);
        if (updated?.vocal_range) {
          // Notify renderer windows of updated song metadata
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('library:song-updated', updated);
            }
          });
        }
      }
    } catch (err) {
      console.warn(`[VocalRangeQueue] Failed to auto-analyze song ${nextId}:`, err);
    } finally {
      this.isProcessing = false;
      // Inter-song cooldown: sleep 3 seconds to let system idle and prevent CPU throttling
      if (!this.isDestroyed && this.queue.length > 0) {
        setTimeout(() => this.processNext(), 3000);
      }
    }
  }
}

export const vocalRangeAutoQueue = new VocalRangeAutoQueue();

export function startVocalRangeAutoQueue(delayMs: number = 8000) {
  vocalRangeAutoQueue.start(delayMs);
}

export function queueVocalRangeAnalysis(songId: string) {
  vocalRangeAutoQueue.queueSong(songId);
}
