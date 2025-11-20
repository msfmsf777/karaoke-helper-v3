export type OutputRole = 'stream' | 'headphone';

export interface AudioEngine {
  loadFile(path: string): Promise<void>;
  play(): Promise<void> | void;
  pause(): void;
  stop(): void;
  seek(positionSeconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  onTimeUpdate(callback: (timeSeconds: number) => void): () => void;
  onEnded(callback: () => void): () => void;
  enumerateOutputDevices(): Promise<MediaDeviceInfo[]>;
  setOutputDevice(role: OutputRole, deviceId: string | null): Promise<void>;
  setOutputVolume(role: OutputRole, volume: number): void;
}

type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

interface OutputPath {
  role: OutputRole;
  deviceId: string | null;
  element: SinkableAudioElement;
  destination: MediaStreamAudioDestinationNode;
  volume: number;
}

const DEFAULT_OUTPUT_VOLUME: Record<OutputRole, number> = {
  stream: 0.8,
  headphone: 1,
};

class HtmlAudioEngine implements AudioEngine {
  private source: HTMLAudioElement;
  private audioContext: AudioContext;
  private sourceNode: MediaElementAudioSourceNode;
  private fallbackGain: GainNode;
  private outputs: Record<OutputRole, OutputPath>;
  private timeUpdateSubscribers = new Set<(timeSeconds: number) => void>();
  private endedSubscribers = new Set<() => void>();
  private currentFilePath: string | null = null;
  private sinkWarningLogged = false;

  constructor() {
    this.source = new Audio();
    this.source.preload = 'auto';
    this.source.muted = false;

    this.source.addEventListener('timeupdate', () => {
      const time = this.getCurrentTime();
      this.timeUpdateSubscribers.forEach((cb) => cb(time));
    });

    this.source.addEventListener('ended', () => {
      this.endedSubscribers.forEach((cb) => cb());
    });

    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaElementSource(this.source);
    this.fallbackGain = this.audioContext.createGain();
    // Keep fallback silent unless multi-output path fails; avoids double audio on the same device.
    this.fallbackGain.gain.value = 0;

    this.outputs = {
      stream: this.createOutputPath('stream'),
      headphone: this.createOutputPath('headphone'),
    };

    this.sourceNode.connect(this.outputs.stream.destination);
    this.sourceNode.connect(this.outputs.headphone.destination);
    this.sourceNode.connect(this.fallbackGain).connect(this.audioContext.destination);
  }

  private createOutputPath(role: OutputRole): OutputPath {
    const destination = this.audioContext.createMediaStreamDestination();
    const element: SinkableAudioElement = new Audio();
    element.preload = 'auto';
    element.autoplay = false;
    element.loop = false;
    element.srcObject = destination.stream;
    element.volume = DEFAULT_OUTPUT_VOLUME[role];

    return {
      role,
      deviceId: null,
      element,
      destination,
      volume: DEFAULT_OUTPUT_VOLUME[role],
    };
  }

  private toFileUrl(filePath: string): string {
    if (filePath.startsWith('file://')) {
      return filePath;
    }

    const normalized = filePath.replace(/\\/g, '/');
    // Ensure the URL is properly encoded for spaces and non-ASCII characters.
    return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  }

  private async ensureOutputsPlaying(): Promise<boolean> {
    let started = false;
    const plays = Object.values(this.outputs).map(async ({ element, role }) => {
      if (!element.paused) {
        started = true;
        return;
      }
      try {
        await element.play();
        started = true;
      } catch (err) {
        console.warn(`[AudioEngine] Failed to start ${role} output element`, err);
      }
    });
    await Promise.all(plays);
    // If neither output could start, fall back to direct output so the user still hears audio.
    this.fallbackGain.gain.value = started ? 0 : 1;
    return started;
  }

  private pauseOutputs(): void {
    Object.values(this.outputs).forEach(({ element }) => {
      if (!element.paused) {
        element.pause();
      }
    });
  }

  private logSinkUnsupported(): void {
    if (this.sinkWarningLogged) return;
    console.warn('[AudioEngine] setSinkId not supported; using default output for all roles.');
    this.sinkWarningLogged = true;
  }

  async loadFile(path: string): Promise<void> {
    if (!path) {
      throw new Error('[AudioEngine] No file path provided');
    }

    const source = this.toFileUrl(path);
    this.currentFilePath = path;
    this.source.pause();
    this.source.currentTime = 0;

    return new Promise((resolve, reject) => {
      const handleLoaded = () => {
        cleanup();
        this.source.currentTime = 0;
        resolve();
      };

      const handleError = (event: Event | string) => {
        cleanup();
        console.error('[AudioEngine] Failed to load file', path, event);
        reject(new Error('Failed to load audio file'));
      };

      const cleanup = () => {
        this.source.removeEventListener('loadedmetadata', handleLoaded);
        this.source.removeEventListener('error', handleError as EventListener);
      };

      this.source.addEventListener('loadedmetadata', handleLoaded);
      this.source.addEventListener('error', handleError as EventListener);

      this.source.src = source;
      this.source.load();
    });
  }

  async play(): Promise<void> {
    if (!this.source.src) {
      console.warn('[AudioEngine] play() called with no audio loaded');
      return;
    }

    try {
      await this.audioContext.resume();
    } catch (err) {
      console.warn('[AudioEngine] Failed to resume AudioContext', err);
    }

    await this.ensureOutputsPlaying();

    try {
      await this.source.play();
    } catch (err) {
      console.error('[AudioEngine] play() failed', err, this.currentFilePath);
    }
  }

  pause(): void {
    this.source.pause();
    this.pauseOutputs();
  }

  stop(): void {
    this.source.pause();
    this.pauseOutputs();
    this.source.currentTime = 0;
  }

  seek(positionSeconds: number): void {
    if (!this.source.src) {
      console.warn('[AudioEngine] seek() called with no audio loaded');
      return;
    }

    const duration = this.getDuration();
    const upperBound = duration > 0 ? duration : 0;
    const target = duration > 0 ? Math.min(positionSeconds, upperBound) : positionSeconds;
    const clamped = Math.max(0, target);
    this.source.currentTime = Number.isFinite(clamped) ? clamped : 0;
  }

  getCurrentTime(): number {
    return Number.isFinite(this.source.currentTime) ? this.source.currentTime : 0;
  }

  getDuration(): number {
    return Number.isFinite(this.source.duration) ? this.source.duration : 0;
  }

  isPlaying(): boolean {
    return !this.source.paused && !this.source.ended;
  }

  onTimeUpdate(callback: (timeSeconds: number) => void): () => void {
    this.timeUpdateSubscribers.add(callback);
    return () => this.timeUpdateSubscribers.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedSubscribers.add(callback);
    return () => this.endedSubscribers.delete(callback);
  }

  async enumerateOutputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      console.warn('[AudioEngine] navigator.mediaDevices.enumerateDevices is unavailable');
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      console.log('[AudioEngine] Enumerated output devices', outputs.map((d) => ({ id: d.deviceId, label: d.label })));
      return outputs;
    } catch (err) {
      console.error('[AudioEngine] Failed to enumerate devices', err);
      return [];
    }
  }

  async setOutputDevice(role: OutputRole, deviceId: string | null): Promise<void> {
    const output = this.outputs[role];
    output.deviceId = deviceId;
    const sinkId = deviceId ?? '';

    if (!output.element.setSinkId) {
      this.logSinkUnsupported();
      return;
    }

    try {
      await output.element.setSinkId(sinkId);
      console.log(`[AudioEngine] Set ${role} output device`, sinkId || 'default');
      if (this.isPlaying()) {
        await this.ensureOutputsPlaying();
      }
    } catch (err) {
      console.error(`[AudioEngine] Failed to set ${role} output device`, sinkId, err);
      this.fallbackGain.gain.value = 1;
    }
  }

  setOutputVolume(role: OutputRole, volume: number): void {
    const clamped = Math.max(0, Math.min(volume, 1));
    const output = this.outputs[role];
    output.volume = clamped;
    output.element.volume = clamped;
    console.log(`[AudioEngine] Set ${role} output volume`, clamped);
  }
}

const audioEngine: AudioEngine = new HtmlAudioEngine();

export default audioEngine;
