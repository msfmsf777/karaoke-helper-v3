// Extend AudioContext to support setSinkId (experimental/Electron)
interface AudioContextWithSinkId extends AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

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
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
}

type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

// --- Audio Worklet Processor Code ---
// We define this as a string to avoid needing a separate file/loader config.
// This processor mimics the Python _hp_callback: it pulls data from a buffer.
const workletCode = `
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.leftBuffer = null;
    this.rightBuffer = null;
    this.bufferLength = 0;
    this.cursor = 0;
    this.playing = false;
    this.playbackRate = 1.0;
    
    this.port.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'load') {
        this.leftBuffer = payload.left;
        this.rightBuffer = payload.right;
        this.bufferLength = this.leftBuffer.length;
        this.cursor = 0;
        this.playing = false;
        this.port.postMessage({ type: 'loaded', duration: this.bufferLength / sampleRate });
      } else if (type === 'play') {
        this.playing = true;
      } else if (type === 'pause') {
        this.playing = false;
      } else if (type === 'stop') {
        this.playing = false;
        this.cursor = 0;
        this.port.postMessage({ type: 'time', time: 0 });
      } else if (type === 'seek') {
        // payload is time in seconds
        this.cursor = Math.floor(payload * sampleRate);
        if (this.cursor < 0) this.cursor = 0;
        if (this.cursor >= this.bufferLength) this.cursor = this.bufferLength - 1;
        this.port.postMessage({ type: 'time', time: this.cursor / sampleRate });
      } else if (type === 'rate') {
        this.playbackRate = payload;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channelCount = output.length;
    
    if (!this.leftBuffer || !this.playing) {
      return true; // Keep processor alive
    }

    const outputLength = output[0].length;
    
    // Simple playback loop
    // Note: For high-quality resampling with variable playbackRate, 
    // we would need linear interpolation. For now, we'll use nearest-neighbor 
    // (or simple index increment) which is "good enough" for 1.0x rate 
    // and basic pitch shifting if rate != 1.0.
    
    for (let i = 0; i < outputLength; i++) {
      if (this.cursor >= this.bufferLength) {
        this.playing = false;
        this.port.postMessage({ type: 'ended' });
        break;
      }

      // Read from buffer
      // If we wanted to support rate != 1.0 smoothly, we'd use a float cursor and interpolate.
      // For this implementation, we'll stick to integer steps for 1.0 stability, 
      // but allow float increments for rate support.
      const idx = Math.floor(this.cursor);
      
      if (channelCount > 0) output[0][i] = this.leftBuffer[idx] || 0;
      if (channelCount > 1) output[1][i] = this.rightBuffer[idx] || 0;

      this.cursor += this.playbackRate;
    }
    
    // Report time every ~100ms (approx every 4-5 blocks at 44.1k/128)
    // Actually, let's just report every block and let main thread throttle if needed, 
    // or report every N blocks.
    if (currentTime % 0.1 < 0.01) {
       this.port.postMessage({ type: 'time', time: this.cursor / sampleRate });
    }

    return true;
  }
}

registerProcessor('pcm-player', PCMPlayerProcessor);
`;

/**
 * Wraps the AudioWorkletNode and AudioContext.
 * Equivalent to the Python 'AudioPlayer' class but for a single output.
 */
class AudioPlayer {
  public audioContext: AudioContextWithSinkId;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode;

  // Fallback
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private audioElement: SinkableAudioElement | null = null;

  private role: OutputRole;
  private isReady = false;

  // State mirrors
  private _duration = 0;
  private _currentTime = 0;
  private _isPlaying = false;

  constructor(role: OutputRole) {
    this.role = role;
    this.audioContext = new AudioContext({ latencyHint: 'playback' }) as AudioContextWithSinkId;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    console.log(`[${role}Player] Created. SampleRate: ${this.audioContext.sampleRate}`);
    this.initWorklet();
  }

  private async initWorklet() {
    try {
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-player', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      this.workletNode.port.onmessage = (e) => {
        const { type, time, duration } = e.data;
        if (type === 'time') {
          this._currentTime = time;
        } else if (type === 'loaded') {
          this._duration = duration;
        } else if (type === 'ended') {
          this._isPlaying = false;
          // We let the main engine handle the global 'ended' event
        }
      };

      this.workletNode.connect(this.gainNode);
      this.isReady = true;
      console.log(`[${this.role}Player] Worklet initialized.`);
    } catch (err) {
      console.error(`[${this.role}Player] Failed to init worklet`, err);
    }
  }

  async setSinkId(deviceId: string | null) {
    const sinkId = deviceId ?? '';

    if (typeof this.audioContext.setSinkId === 'function') {
      try {
        await this.audioContext.setSinkId(sinkId);
        console.log(`[${this.role}Player] setSinkId success: ${sinkId || 'default'}`);
        return;
      } catch (err) {
        console.warn(`[${this.role}Player] setSinkId failed, trying fallback`, err);
      }
    }

    // Fallback
    if (!this.destinationNode) {
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.gainNode.disconnect();
      this.gainNode.connect(this.destinationNode);

      this.audioElement = new Audio();
      this.audioElement.srcObject = this.destinationNode.stream;
      this.audioElement.autoplay = true;
    }

    if (this.audioElement && this.audioElement.setSinkId) {
      try {
        await this.audioElement.setSinkId(sinkId);
        if (this.audioElement.paused) this.audioElement.play();
      } catch (err) { /* ignore */ }
    }
  }

  async loadBuffer(arrayBuffer: ArrayBuffer) {
    if (!this.isReady || !this.workletNode) await this.initWorklet();

    // Decode
    const bufferCopy = arrayBuffer.slice(0);
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const audioBuffer = await this.audioContext.decodeAudioData(bufferCopy);

    // Extract channels
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;

    // Send to Worklet
    this.workletNode?.port.postMessage({
      type: 'load',
      payload: { left, right }
    });

    this._duration = audioBuffer.duration;
    this._currentTime = 0;
    this._isPlaying = false;
  }

  play() {
    this.audioContext.resume();
    this.workletNode?.port.postMessage({ type: 'play' });
    this._isPlaying = true;

    // Ensure fallback element is playing if active
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch(() => { });
    }
  }

  pause() {
    this.workletNode?.port.postMessage({ type: 'pause' });
    this._isPlaying = false;
  }

  stop() {
    this.workletNode?.port.postMessage({ type: 'stop' });
    this._isPlaying = false;
    this._currentTime = 0;
  }

  seek(time: number) {
    this.workletNode?.port.postMessage({ type: 'seek', payload: time });
    this._currentTime = time;
  }

  setVolume(vol: number) {
    this.gainNode.gain.value = vol;
  }

  setRate(rate: number) {
    this.workletNode?.port.postMessage({ type: 'rate', payload: rate });
  }

  // Getters
  get currentTime() { return this._currentTime; }
  get duration() { return this._duration; }
  get isPlaying() { return this._isPlaying; }
}

class DualAudioEngine implements AudioEngine {
  private streamPlayer: AudioPlayer;
  private headphonePlayer: AudioPlayer;

  private timeUpdateSubscribers = new Set<(timeSeconds: number) => void>();
  private endedSubscribers = new Set<() => void>();
  private animationFrameId: number | null = null;
  private playbackRate = 1;

  constructor() {
    console.log('[AudioEngine] Initializing Worklet-based Dual Engine...');
    this.streamPlayer = new AudioPlayer('stream');
    this.headphonePlayer = new AudioPlayer('headphone');

    this.streamPlayer.setVolume(0.8);
    this.headphonePlayer.setVolume(1.0);
  }

  private toFileUrl(filePath: string): string {
    if (filePath.startsWith('file://')) return filePath;
    const normalized = filePath.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  }

  // --- Polling Loop for UI ---
  // Even though Worklet posts messages, we use RAF for UI smoothness and to aggregate
  private startTimer() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const loop = () => {
      if (this.isPlaying()) {
        const time = this.headphonePlayer.currentTime;
        const duration = this.headphonePlayer.duration;

        this.timeUpdateSubscribers.forEach((cb) => cb(time));

        if (duration > 0 && (time >= duration || Math.abs(time - duration) < 0.1)) {
          this.handleEnded();
        } else {
          this.animationFrameId = requestAnimationFrame(loop);
        }
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopTimer() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private handleEnded() {
    this.stop();
    this.endedSubscribers.forEach(cb => cb());
  }

  // --- Public API ---

  async loadFile(path: string): Promise<void> {
    if (!path) throw new Error('No path');
    this.stop();
    console.log('[AudioEngine] Loading:', path);

    const url = this.toFileUrl(path);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    await Promise.all([
      this.streamPlayer.loadBuffer(arrayBuffer),
      this.headphonePlayer.loadBuffer(arrayBuffer)
    ]);

    this.setPlaybackRate(1.0);
  }

  play(): void {
    // Sync start
    this.streamPlayer.play();
    this.headphonePlayer.play();
    this.startTimer();
  }

  pause(): void {
    this.streamPlayer.pause();
    this.headphonePlayer.pause();
    this.stopTimer();

    // Final sync
    const time = this.headphonePlayer.currentTime;
    this.timeUpdateSubscribers.forEach(cb => cb(time));
  }

  stop(): void {
    this.streamPlayer.stop();
    this.headphonePlayer.stop();
    this.stopTimer();
    this.timeUpdateSubscribers.forEach(cb => cb(0));
  }

  seek(positionSeconds: number): void {
    this.streamPlayer.seek(positionSeconds);
    this.headphonePlayer.seek(positionSeconds);
    this.timeUpdateSubscribers.forEach(cb => cb(positionSeconds));
  }

  getCurrentTime(): number {
    return this.headphonePlayer.currentTime;
  }

  getDuration(): number {
    return this.headphonePlayer.duration;
  }

  isPlaying(): boolean {
    return this.headphonePlayer.isPlaying;
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
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audiooutput');
    } catch (err) {
      return [];
    }
  }

  async setOutputDevice(role: OutputRole, deviceId: string | null): Promise<void> {
    if (role === 'stream') {
      await this.streamPlayer.setSinkId(deviceId);
    } else {
      await this.headphonePlayer.setSinkId(deviceId);
    }
  }

  setOutputVolume(role: OutputRole, volume: number): void {
    if (role === 'stream') {
      this.streamPlayer.setVolume(volume);
    } else {
      this.headphonePlayer.setVolume(volume);
    }
  }

  setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.5, Math.min(rate, 2));
    this.playbackRate = clamped;
    this.streamPlayer.setRate(clamped);
    this.headphonePlayer.setRate(clamped);
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }
}

const audioEngine: AudioEngine = new DualAudioEngine();

export default audioEngine;
