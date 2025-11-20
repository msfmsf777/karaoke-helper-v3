export interface AudioEngine {
  loadFile(path: string): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  seek(positionSeconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  onTimeUpdate(callback: (timeSeconds: number) => void): () => void;
  onEnded(callback: () => void): () => void;
}

class HtmlAudioEngine implements AudioEngine {
  private audio: HTMLAudioElement;
  private timeUpdateSubscribers = new Set<(timeSeconds: number) => void>();
  private endedSubscribers = new Set<() => void>();
  private currentFilePath: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      const time = this.getCurrentTime();
      this.timeUpdateSubscribers.forEach((cb) => cb(time));
    });

    this.audio.addEventListener('ended', () => {
      this.endedSubscribers.forEach((cb) => cb());
    });

    this.audio.addEventListener('pause', () => {
      // Keep state accurate so UI can query without reading element state directly.
      // We keep logic in getter but this ensures future backend parity.
    });
  }

  private toFileUrl(filePath: string): string {
    if (filePath.startsWith('file://')) {
      return filePath;
    }

    const normalized = filePath.replace(/\\/g, '/');
    // Ensure the URL is properly encoded for spaces and non-ASCII characters.
    return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  }

  async loadFile(path: string): Promise<void> {
    if (!path) {
      throw new Error('[AudioEngine] No file path provided');
    }

    const source = this.toFileUrl(path);
    this.currentFilePath = path;
    this.audio.pause();
    this.audio.currentTime = 0;

    return new Promise((resolve, reject) => {
      const handleLoaded = () => {
        cleanup();
        this.audio.currentTime = 0;
        resolve();
      };

      const handleError = (event: Event | string) => {
        cleanup();
        console.error('[AudioEngine] Failed to load file', path, event);
        reject(new Error('Failed to load audio file'));
      };

      const cleanup = () => {
        this.audio.removeEventListener('loadedmetadata', handleLoaded);
        this.audio.removeEventListener('error', handleError as EventListener);
      };

      this.audio.addEventListener('loadedmetadata', handleLoaded);
      this.audio.addEventListener('error', handleError as EventListener);

      this.audio.src = source;
      this.audio.load();
    });
  }

  play(): void {
    if (!this.audio.src) {
      console.warn('[AudioEngine] play() called with no audio loaded');
      return;
    }

    this.audio.play().catch((err) => {
      console.error('[AudioEngine] play() failed', err, this.currentFilePath);
    });
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(positionSeconds: number): void {
    if (!this.audio.src) {
      console.warn('[AudioEngine] seek() called with no audio loaded');
      return;
    }

    const duration = this.getDuration();
    const upperBound = duration > 0 ? duration : 0;
    const target = duration > 0 ? Math.min(positionSeconds, upperBound) : positionSeconds;
    const clamped = Math.max(0, target);
    this.audio.currentTime = Number.isFinite(clamped) ? clamped : 0;
  }

  getCurrentTime(): number {
    return Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
  }

  getDuration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  onTimeUpdate(callback: (timeSeconds: number) => void): () => void {
    this.timeUpdateSubscribers.add(callback);
    return () => this.timeUpdateSubscribers.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedSubscribers.add(callback);
    return () => this.endedSubscribers.delete(callback);
  }
}

const audioEngine: AudioEngine = new HtmlAudioEngine();

export default audioEngine;
