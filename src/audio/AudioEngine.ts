
// Extend AudioContext to support setSinkId (experimental/Electron)
interface AudioContextWithSinkId extends AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

export type OutputRole = 'stream' | 'headphone';
export type TrackType = 'instrumental' | 'vocal';

export interface AudioEngine {
  loadFile(paths: string | { instrumental: string; vocal: string | null }): Promise<void>;
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
  setTrackVolume(track: TrackType, volume: number): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
}

type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

// --- Audio Worklet Processor Code ---
const workletCode = `
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Buffers
    this.instrLeft = null;
    this.instrRight = null;
    this.vocalLeft = null;
    this.vocalRight = null;

    this.bufferLength = 0;
    this.cursor = 0;
    this.playing = false;
    this.playbackRate = 1.0;

    // Volumes
    this.instrVolume = 1.0;
    this.vocalVolume = 1.0;

    this.port.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'load') {
        this.instrLeft = payload.instrLeft;
        this.instrRight = payload.instrRight;
        this.vocalLeft = payload.vocalLeft;
        this.vocalRight = payload.vocalRight;

        // Determine length from whatever is available
        this.bufferLength = 0;
        if (this.instrLeft) this.bufferLength = Math.max(this.bufferLength, this.instrLeft.length);
        if (this.vocalLeft) this.bufferLength = Math.max(this.bufferLength, this.vocalLeft.length);

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
        this.cursor = Math.floor(payload * sampleRate);
        if (this.cursor < 0) this.cursor = 0;
        if (this.cursor >= this.bufferLength) this.cursor = this.bufferLength - 1;
        this.port.postMessage({ type: 'time', time: this.cursor / sampleRate });
      } else if (type === 'rate') {
        this.playbackRate = payload;
      } else if (type === 'volumes') {
        this.instrVolume = payload.instr;
        this.vocalVolume = payload.vocal;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channelCount = output.length;

    if (this.bufferLength === 0 || !this.playing) {
      return true;
    }

    const outputLength = output[0].length;

    for (let i = 0; i < outputLength; i++) {
      if (this.cursor >= this.bufferLength) {
        this.playing = false;
        this.port.postMessage({ type: 'ended' });
        break;
      }

      const idx = Math.floor(this.cursor);

      // Fetch samples (default to 0 if missing)
      const iL = this.instrLeft ? (this.instrLeft[idx] || 0) : 0;
      const iR = this.instrRight ? (this.instrRight[idx] || 0) : 0;
      const vL = this.vocalLeft ? (this.vocalLeft[idx] || 0) : 0;
      const vR = this.vocalRight ? (this.vocalRight[idx] || 0) : 0;

      // Mix
      const left = (iL * this.instrVolume) + (vL * this.vocalVolume);
      const right = (iR * this.instrVolume) + (vR * this.vocalVolume);

      if (channelCount > 0) output[0][i] = left;
      if (channelCount > 1) output[1][i] = right;

      this.cursor += this.playbackRate;
    }

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

    console.log(`[${role}Player]Created.SampleRate: ${this.audioContext.sampleRate} `);
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
    const sinkId = (deviceId === 'default' || !deviceId) ? '' : deviceId;

    if (typeof this.audioContext.setSinkId === 'function') {
      try {
        await this.audioContext.setSinkId(sinkId);
        console.log(`[${this.role}Player] setSinkId success: ${sinkId || 'default'} `);
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

  async loadBuffers(instrBuffer: AudioBuffer | null, vocalBuffer: AudioBuffer | null) {
    if (!this.isReady || !this.workletNode) await this.initWorklet();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const payload: any = {};

    if (instrBuffer) {
      payload.instrLeft = instrBuffer.getChannelData(0);
      payload.instrRight = instrBuffer.numberOfChannels > 1 ? instrBuffer.getChannelData(1) : payload.instrLeft;
    }
    if (vocalBuffer) {
      payload.vocalLeft = vocalBuffer.getChannelData(0);
      payload.vocalRight = vocalBuffer.numberOfChannels > 1 ? vocalBuffer.getChannelData(1) : payload.vocalLeft;
    }

    this.workletNode?.port.postMessage({ type: 'load', payload });

    // Duration is set by worklet response
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

  setTrackVolumes(instr: number, vocal: number) {
    this.workletNode?.port.postMessage({ type: 'volumes', payload: { instr, vocal } });
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

  // Track volumes
  private instrVolume = 1.0;
  private vocalVolume = 1.0;

  constructor() {
    console.log('[AudioEngine] Initializing Worklet-based Dual Engine (Stem Support)...');
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

  async loadFile(paths: string | { instrumental: string; vocal: string | null }): Promise<void> {
    this.stop();

    let instrPath: string;
    let vocalPath: string | null;

    if (typeof paths === 'string') {
      instrPath = paths;
      vocalPath = paths; // Fallback: load same file for both if single path provided
    } else {
      instrPath = paths.instrumental;
      vocalPath = paths.vocal;
    }

    console.log('[AudioEngine] Loading:', { instrPath, vocalPath });

    const instrUrl = this.toFileUrl(instrPath);
    const vocalUrl = vocalPath ? this.toFileUrl(vocalPath) : null;

    // Fetch buffers
    const [instrBuf, vocalBuf] = await Promise.all([
      fetch(instrUrl).then(r => r.arrayBuffer()),
      vocalUrl ? fetch(vocalUrl).then(r => r.arrayBuffer()) : Promise.resolve(null)
    ]);

    // Decode for Stream Player
    // Stream only needs Instrumental, but we load both to keep logic simple or if we change mind.
    // Actually, user said Stream = Instr Only.
    // We can enforce this by setting volumes, OR by only loading Instr buffer.
    // Setting volumes is more flexible (allows toggle later).

    // We need to decode specifically for each context to match sample rates.
    const decode = async (ctx: AudioContext, buf: ArrayBuffer | null) => {
      // If buffer is empty (e.g., vocalPath was null/empty), return null
      if (!buf || buf.byteLength === 0) return null;
      return ctx.decodeAudioData(buf.slice(0));
    };

    // Parallel decode for both engines
    await Promise.all([
      (async () => {
        const i = await decode(this.streamPlayer.audioContext, instrBuf);
        const v = await decode(this.streamPlayer.audioContext, vocalBuf);
        await this.streamPlayer.loadBuffers(i, v);
      })(),
      (async () => {
        const i = await decode(this.headphonePlayer.audioContext, instrBuf);
        const v = await decode(this.headphonePlayer.audioContext, vocalBuf);
        await this.headphonePlayer.loadBuffers(i, v);
      })()
    ]);

    this.setPlaybackRate(1.0);
    this.applyTrackVolumes(); // Apply initial mixing rules
  }

  private applyTrackVolumes() {
    // Stream: Instr Only (Vocal = 0)
    // Headphone: Instr + Vocal

    // Stream Player
    this.streamPlayer.setTrackVolumes(this.instrVolume, 0);

    // Headphone Player
    this.headphonePlayer.setTrackVolumes(this.instrVolume, this.vocalVolume);
  }

  play(): void {
    this.streamPlayer.play();
    this.headphonePlayer.play();
    this.startTimer();
  }

  pause(): void {
    this.streamPlayer.pause();
    this.headphonePlayer.pause();
    this.stopTimer();
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

  setTrackVolume(track: TrackType, volume: number): void {
    if (track === 'instrumental') {
      this.instrVolume = volume;
    } else {
      this.vocalVolume = volume;
    }
    this.applyTrackVolumes();
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
