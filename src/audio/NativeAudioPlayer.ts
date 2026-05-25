type OutputRole = 'stream' | 'headphone';
type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

export class NativeAudioPlayer {
  private readonly el: SinkableAudioElement;
  private readonly role: OutputRole;
  private pendingPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelPendingLoad: (() => void) | null = null;
  public onEnded?: () => void;
  public loop = false;

  constructor(role: OutputRole, audioElement?: HTMLAudioElement) {
    this.role = role;
    this.el = (audioElement ?? new Audio()) as SinkableAudioElement;
    this.el.crossOrigin = 'anonymous';
    this.el.onended = () => {
      if (this.loop) {
        this.el.currentTime = 0;
        this.el.play().catch(() => {});
      } else {
        this.onEnded?.();
      }
    };
  }

  async loadUrl(url: string, waitUntilReady = true): Promise<void> {
    this.cancelPendingLoad?.();
    this.pause();
    this.el.src = url;

    if (!waitUntilReady) {
      this.el.load();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        this.el.removeEventListener('canplay', onReady);
        this.el.removeEventListener('error', onError);
        if (this.cancelPendingLoad === cancel) this.cancelPendingLoad = null;
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onReady = () => finish();
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Failed to load native ${this.role} audio stream`));
      };
      const cancel = () => finish();

      this.cancelPendingLoad = cancel;
      this.el.addEventListener('canplay', onReady);
      this.el.addEventListener('error', onError);
      this.el.load();

      if (this.el.readyState >= 3) finish();
    });
  }

  async setSinkId(deviceId: string | null): Promise<void> {
    if (!this.el.setSinkId) return;
    try {
      await this.el.setSinkId(deviceId || '');
    } catch {
      // Keep the browser-selected output if sink routing is unsupported.
    }
  }

  play(delayMs = 0): void {
    this.clearPendingPlay();
    if (delayMs <= 0) {
      this.el.play().catch(() => {});
      return;
    }
    this.pendingPlayTimer = setTimeout(() => {
      this.pendingPlayTimer = null;
      this.el.play().catch(() => {});
    }, delayMs);
  }

  pause(): void {
    this.clearPendingPlay();
    this.el.pause();
  }

  stop(): void {
    this.pause();
    this.el.currentTime = 0;
  }

  seek(time: number): void {
    this.el.currentTime = time;
  }

  setVolume(vol: number): void {
    this.el.volume = Math.min(Math.max(vol, 0), 1);
  }

  get currentTime(): number { return this.el.currentTime; }
  get duration(): number { return this.el.duration || 0; }
  get isPlaying(): boolean { return !this.el.paused; }
  get isPendingPlay(): boolean { return this.pendingPlayTimer !== null; }
  get volume(): number { return this.el.volume; }
  get sampleRate(): number { return 44100; }
  get outputRole(): OutputRole { return this.role; }

  dispose(): void {
    this.cancelPendingLoad?.();
    this.stop();
    this.el.src = '';
  }

  private clearPendingPlay(): void {
    if (this.pendingPlayTimer === null) return;
    clearTimeout(this.pendingPlayTimer);
    this.pendingPlayTimer = null;
  }
}
