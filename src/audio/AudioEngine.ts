
// Extend AudioContext to support setSinkId (experimental/Electron)
interface AudioContextWithSinkId extends AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

// Import SoundTouchJS and Processor code as raw strings
import soundtouchLib from 'soundtouchjs/dist/soundtouch.js?raw';
import processorCode from './SoundTouchProcessor.js?raw';

export type OutputRole = 'stream' | 'headphone';
export type TrackType = 'instrumental' | 'vocal';

export interface PlaybackTransform {
  speed: number;       // 0.5–2.0
  transpose: number;   // -12–+12 semitones
}

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

  // New API
  setPlaybackTransform(transform: PlaybackTransform): void;
  getPlaybackTransform(): PlaybackTransform;

  // Calibration
  // Calibration
  setOffset(offsetMs: number): void;
  setLoop(loop: boolean): void;
  getSampleRate(role: OutputRole): number;
  getVolume(role: OutputRole): number;
  getTrackVolume(track: TrackType): number;
}

type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

/**
 * Wraps the AudioWorkletNode and AudioContext.
 */
class AudioPlayer {
  public audioContext: AudioContextWithSinkId;
  private workletNode: AudioWorkletNode | null = null;
  private delayNode: DelayNode;
  private gainNode: GainNode;

  // Fallback
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private audioElement: SinkableAudioElement | null = null;

  private role: OutputRole;
  private isReady = false;
  public loop = false;

  // State mirrors
  private _duration = 0;
  private _currentTime = 0;
  private _isPlaying = false;

  public onEnded?: () => void;

  constructor(role: OutputRole) {
    this.role = role;
    this.audioContext = new AudioContext({ latencyHint: 'playback' }) as AudioContextWithSinkId;

    this.delayNode = this.audioContext.createDelay(1.0); // Max delay 1 second
    this.gainNode = this.audioContext.createGain();

    // Chain: Worklet -> Delay -> Gain -> Destination
    this.delayNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    console.log(`[${role}Player] Created. SampleRate: ${this.audioContext.sampleRate}`);
    this.initWorklet();
  }

  private async initWorklet() {
    try {
      // Shim for SoundTouchJS to ensure it attaches to global scope
      // It likely checks for window/self/global. We force them all to globalThis.
      // We also mock module/exports so it doesn't try to export as a module if it detects CommonJS,
      // which might hide the global definition.
      const shim = `
        var global = globalThis;
        var window = globalThis;
        var self = globalThis;
        var module = { exports: {} };
        var exports = module.exports;
        var define = undefined;
      `;
      const combinedCode = `${shim}\n${soundtouchLib}\n${processorCode}`;

      const blob = new Blob([combinedCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);

      this.workletNode = new AudioWorkletNode(this.audioContext, 'soundtouch-processor', {
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
          if (this.loop) {
            this.seek(0);
          } else {
            this._isPlaying = false;
            // Trigger internal callback to notify engine
            if (this.onEnded) this.onEnded();
          }
        }
      };

      this.workletNode.connect(this.delayNode);
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

  setTransform(transform: PlaybackTransform) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setPlaybackTransform', payload: transform });
    } else {
      console.warn(`[${this.role}Player] setTransform called but workletNode is null`);
    }
  }

  setDelay(seconds: number) {
    // Smooth transition
    this.delayNode.delayTime.setTargetAtTime(seconds, this.audioContext.currentTime, 0.05);
  }

  // Getters
  get currentTime() { return this._currentTime; }
  get duration() { return this._duration; }
  get isPlaying() { return this._isPlaying; }
  get volume() { return this.gainNode.gain.value; }

  dispose() {
    this.stop();
    this.audioContext.close();
  }

  get sampleRate() {
    return this.audioContext.sampleRate;
  }
}

export class DualAudioEngine implements AudioEngine {
  private streamPlayer: AudioPlayer;
  private headphonePlayer: AudioPlayer;

  private timeUpdateSubscribers = new Set<(timeSeconds: number) => void>();
  private endedSubscribers = new Set<() => void>();
  private animationFrameId: number | null = null;

  private transform: PlaybackTransform = { speed: 1.0, transpose: 0 };

  // Track volumes
  private instrVolume = 1.0;
  private vocalVolume = 1.0;

  constructor() {
    console.log('[AudioEngine] Initializing SoundTouch-based Dual Engine...');
    this.streamPlayer = new AudioPlayer('stream');
    this.headphonePlayer = new AudioPlayer('headphone');

    // Wire up event-based ended detection to avoid race conditions in the render loop
    this.headphonePlayer.onEnded = () => {
      this.handleEnded();
    };

    this.streamPlayer.setVolume(0.8);
    this.headphonePlayer.setVolume(1.0);
  }

  private toFileUrl(filePath: string): string {
    if (filePath.startsWith('file://') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
      return filePath;
    }
    const normalized = filePath.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  }

  private startTimer() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const loop = () => {
      if (this.isPlaying()) {
        const time = this.headphonePlayer.currentTime;
        this.timeUpdateSubscribers.forEach((cb) => cb(time));
        this.animationFrameId = requestAnimationFrame(loop);
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

    const decode = async (ctx: AudioContext, buf: ArrayBuffer | null) => {
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

    // Reset transform - REMOVED to allow external control and avoid race/redundancy
    // this.setPlaybackTransform({ speed: 1.0, transpose: 0 });
    this.applyTrackVolumes();
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

  setPlaybackTransform(transform: PlaybackTransform): void {
    this.transform = transform;
    this.streamPlayer.setTransform(transform);
    this.streamPlayer.setTransform(transform);
    this.headphonePlayer.setTransform(transform);
  }

  setOffset(offsetMs: number): void {
    // offsetMs > 0 => Delay Monitor (Headphone)
    // offsetMs < 0 => Delay Stream
    const abs = Math.abs(offsetMs) / 1000;

    if (offsetMs > 0) {
      this.headphonePlayer.setDelay(abs);
      this.streamPlayer.setDelay(0);
    } else {
      this.headphonePlayer.setDelay(0);
      this.streamPlayer.setDelay(abs);
      this.streamPlayer.setDelay(abs);
    }
  }

  setLoop(loop: boolean): void {
    this.streamPlayer.loop = loop;
    this.headphonePlayer.loop = loop;
  }

  getPlaybackTransform(): PlaybackTransform {
    return this.transform;
  }

  dispose() {
    this.streamPlayer.dispose();
    this.headphonePlayer.dispose();
  }

  getSampleRate(role: OutputRole): number {
    return role === 'stream' ? this.streamPlayer.sampleRate : this.headphonePlayer.sampleRate;
  }

  getVolume(role: OutputRole): number {
    // Note: AudioPlayer doesn't expose gain value directly in previous code, 
    // but we can access the private gainNode if we changed AudioPlayer or just store it.
    // For now, let's assume we can access it or we should store it.
    // Re-reading AudioPlayer code... it has `setVolume` which sets `gainNode.gain.value`.
    // It does NOT expose getter.
    // I need to update AudioPlayer to expose volume getter first?
    // Actually, I can just return the local var if I tracked it, but safely accessing the node is better.
    // Let's modify AudioPlayer class first in next step or use 'any' cast as hotfix? No.
    // I'll update AudioPlayer to add 'volume' getter.
    return role === 'stream' ? this.streamPlayer.volume : this.headphonePlayer.volume;
  }

  getTrackVolume(track: TrackType): number {
    return track === 'instrumental' ? this.instrVolume : this.vocalVolume;
  }
}

const audioEngine: AudioEngine = new DualAudioEngine();

export default audioEngine;
