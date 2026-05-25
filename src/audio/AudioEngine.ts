
// Extend AudioContext to support setSinkId (experimental/Electron)
interface AudioContextWithSinkId extends AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

// Import SoundTouchJS and Processor code as raw strings
import soundtouchLib from 'soundtouchjs/dist/soundtouch.js?raw';
import processorCode from './SoundTouchProcessor.js?raw';
import { NativeAudioPlayer } from './NativeAudioPlayer';
import { resolveNativeCompletionRole, resolveNativeStartDelays, resolveOutputGains } from './outputRouting';

export type OutputRole = 'stream' | 'headphone';
export type TrackType = 'instrumental' | 'vocal';

export interface PlaybackTransform {
  speed: number;       // 0.5–2.0
  transpose: number;   // -12–+12 semitones
}

export interface AudioEngine {
  loadFile(paths: string | { instrumental: string; vocal: string | null }): Promise<void>;
  loadStream(url: string): Promise<void>;
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
  onVolumeChange(callback: (track: TrackType, volume: number) => void): () => void;
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

  get outputRole() {
    return this.role;
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
  
  private nativeStreamPlayer: NativeAudioPlayer;
  private nativeHeadphonePlayer: NativeAudioPlayer;
  private activeMode: 'soundtouch' | 'native' = 'soundtouch';

  private timeUpdateSubscribers = new Set<(timeSeconds: number) => void>();
  private endedSubscribers = new Set<() => void>();
  private animationFrameId: number | null = null;
  private loadGeneration = 0;

  private transform: PlaybackTransform = { speed: 1.0, transpose: 0 };

  // Track volumes
  private instrVolume = 1.0;
  private vocalVolume = 1.0;
  private streamOutputGain = 0;
  private headphoneOutputGain = 1.0;
  private streamDeviceId: string | null = null;
  private headphoneDeviceId: string | null = null;
  private offsetMs = 0;

  private volumeCallbacks = new Set<(track: TrackType, volume: number) => void>();

  constructor() {
    console.log('[AudioEngine] Initializing SoundTouch-based Dual Engine...');
    this.streamPlayer = new AudioPlayer('stream');
    this.headphonePlayer = new AudioPlayer('headphone');
    
    this.nativeStreamPlayer = new NativeAudioPlayer('stream');
    this.nativeHeadphonePlayer = new NativeAudioPlayer('headphone');

    // Wire up event-based ended detection to avoid race conditions in the render loop
    this.headphonePlayer.onEnded = () => {
      if (this.activeMode === 'soundtouch') {
          this.handleEnded();
      }
    };
    
    this.nativeStreamPlayer.onEnded = () => {
      if (this.activeMode === 'native' && this.getNativeCompletionRole() === 'stream') {
        this.handleEnded();
      }
    };

    this.nativeHeadphonePlayer.onEnded = () => {
      if (this.activeMode === 'native' && this.getNativeCompletionRole() === 'headphone') {
        this.handleEnded();
      }
    };

    this.applyTrackVolumes();
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
        const time = this.getCurrentTime();
        
        // Sync native stream player if drifting
        const nativeRouting = this.getResolvedOutputGains();
        if (
          this.activeMode === 'native'
          && nativeRouting.stream > 0
          && nativeRouting.headphone > 0
          && this.nativeStreamPlayer.isPlaying
          && this.nativeHeadphonePlayer.isPlaying
        ) {
             const desiredDiff = this.offsetMs / 1000;
             const drift = (this.nativeStreamPlayer.currentTime - this.nativeHeadphonePlayer.currentTime) - desiredDiff;
             if (Math.abs(drift) > 0.15) {
                 this.nativeStreamPlayer.seek(Math.max(0, this.nativeHeadphonePlayer.currentTime + desiredDiff));
             }
        }

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

  async loadStream(url: string): Promise<void> {
    this.stop();
    const generation = ++this.loadGeneration;
    this.activeMode = 'native';
    console.log('[AudioEngine] Loading Native Stream:', url);
    const outputGains = this.getResolvedOutputGains();
    await Promise.all([
      this.nativeStreamPlayer.loadUrl(url, outputGains.stream > 0),
      this.nativeHeadphonePlayer.loadUrl(url, outputGains.headphone > 0)
    ]);
    if (generation !== this.loadGeneration) return;
    this.applyTrackVolumes();
  }

  async loadFile(paths: string | { instrumental: string; vocal: string | null }): Promise<void> {
    this.stop();
    const generation = ++this.loadGeneration;
    this.activeMode = 'soundtouch';

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
    if (generation !== this.loadGeneration) return;

    const decode = async (ctx: AudioContext, buf: ArrayBuffer | null) => {
      if (!buf || buf.byteLength === 0) return null;
      return ctx.decodeAudioData(buf.slice(0));
    };

    // Parallel decode for both engines
    const [streamBuffers, headphoneBuffers] = await Promise.all([
      (async () => ({
        instrumental: await decode(this.streamPlayer.audioContext, instrBuf),
        vocal: await decode(this.streamPlayer.audioContext, vocalBuf),
      }))(),
      (async () => ({
        instrumental: await decode(this.headphonePlayer.audioContext, instrBuf),
        vocal: await decode(this.headphonePlayer.audioContext, vocalBuf),
      }))()
    ]);
    if (generation !== this.loadGeneration) return;

    await Promise.all([
      this.streamPlayer.loadBuffers(streamBuffers.instrumental, streamBuffers.vocal),
      this.headphonePlayer.loadBuffers(headphoneBuffers.instrumental, headphoneBuffers.vocal)
    ]);
    if (generation !== this.loadGeneration) return;

    // Reset transform - REMOVED to allow external control and avoid race/redundancy
    // this.setPlaybackTransform({ speed: 1.0, transpose: 0 });
    this.applyTrackVolumes();
  }

  private applyTrackVolumes() {
    // Stream: Instr Only (Vocal = 0)
    // Headphone: Instr + Vocal
    const outputGains = this.getResolvedOutputGains();

    // Stream Player
    this.streamPlayer.setVolume(outputGains.stream);
    this.streamPlayer.setTrackVolumes(this.instrVolume, 0);
    this.nativeStreamPlayer.setVolume(this.instrVolume * outputGains.stream);

    // Headphone Player
    this.headphonePlayer.setVolume(outputGains.headphone);
    this.headphonePlayer.setTrackVolumes(this.instrVolume, this.vocalVolume);
    // For native mode (unseparated streaming), we map the entire track to the "instrumental" control
    this.nativeHeadphonePlayer.setVolume(this.instrVolume * outputGains.headphone);
  }

  play(): void {
    if (this.activeMode === 'native') {
        const outputGains = this.getResolvedOutputGains();
        const dualOutputAudible = outputGains.stream > 0 && outputGains.headphone > 0;
        const delays = resolveNativeStartDelays(this.offsetMs, dualOutputAudible);
        const position = this.nativeHeadphonePlayer.currentTime;

        this.nativeStreamPlayer.pause();
        this.nativeHeadphonePlayer.pause();
        this.nativeStreamPlayer.seek(position);
        this.nativeHeadphonePlayer.seek(position);

        if (outputGains.stream > 0) this.nativeStreamPlayer.play(delays.stream);
        if (outputGains.headphone > 0) this.nativeHeadphonePlayer.play(delays.headphone);
    } else {
        this.streamPlayer.play();
        this.headphonePlayer.play();
    }
    this.startTimer();
  }

  pause(): void {
    if (this.activeMode === 'native') {
        this.nativeStreamPlayer.pause();
        this.nativeHeadphonePlayer.pause();
    } else {
        this.streamPlayer.pause();
        this.headphonePlayer.pause();
    }
    this.stopTimer();
    const time = this.getCurrentTime();
    this.timeUpdateSubscribers.forEach(cb => cb(time));
  }

  stop(): void {
    if (this.activeMode === 'native') {
        this.nativeStreamPlayer.stop();
        this.nativeHeadphonePlayer.stop();
    } else {
        this.streamPlayer.stop();
        this.headphonePlayer.stop();
    }
    this.stopTimer();
    this.timeUpdateSubscribers.forEach(cb => cb(0));
  }

  seek(positionSeconds: number): void {
    if (this.activeMode === 'native') {
        const shouldResume = this.isPlaying();
        this.nativeStreamPlayer.pause();
        this.nativeHeadphonePlayer.pause();
        this.nativeStreamPlayer.seek(positionSeconds);
        this.nativeHeadphonePlayer.seek(positionSeconds);
        if (shouldResume) this.play();
    } else {
        this.streamPlayer.seek(positionSeconds);
        this.headphonePlayer.seek(positionSeconds);
    }
    this.timeUpdateSubscribers.forEach(cb => cb(positionSeconds));
  }

  getCurrentTime(): number {
    return this.activeMode === 'native' ? this.nativeHeadphonePlayer.currentTime : this.headphonePlayer.currentTime;
  }

  getDuration(): number {
    return this.activeMode === 'native' ? this.nativeHeadphonePlayer.duration : this.headphonePlayer.duration;
  }

  isPlaying(): boolean {
    return this.activeMode === 'native'
      ? this.nativeHeadphonePlayer.isPlaying || this.nativeHeadphonePlayer.isPendingPlay
      : this.headphonePlayer.isPlaying;
  }

  onTimeUpdate(callback: (timeSeconds: number) => void): () => void {
    this.timeUpdateSubscribers.add(callback);
    return () => this.timeUpdateSubscribers.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedSubscribers.add(callback);
    return () => this.endedSubscribers.delete(callback);
  }

  onVolumeChange(callback: (track: TrackType, volume: number) => void): () => void {
    this.volumeCallbacks.add(callback);
    return () => this.volumeCallbacks.delete(callback);
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
    const restartNativePlayback = this.activeMode === 'native' && this.isPlaying();
    if (role === 'stream') {
      this.streamDeviceId = deviceId;
      await this.streamPlayer.setSinkId(deviceId);
      await this.nativeStreamPlayer.setSinkId(deviceId);
    } else {
      this.headphoneDeviceId = deviceId;
      await this.headphonePlayer.setSinkId(deviceId);
      await this.nativeHeadphonePlayer.setSinkId(deviceId);
    }
    this.applyTrackVolumes();
    if (restartNativePlayback) this.seek(this.getCurrentTime());
  }

  setOutputVolume(role: OutputRole, volume: number): void {
    const restartNativePlayback = this.activeMode === 'native' && this.isPlaying();
    if (role === 'stream') {
      this.streamOutputGain = volume;
    } else {
      this.headphoneOutputGain = volume;
    }
    this.applyTrackVolumes();
    if (restartNativePlayback) this.seek(this.getCurrentTime());
  }

  setTrackVolume(track: TrackType, volume: number): void {
    if (track === 'instrumental') {
      this.instrVolume = volume;
    } else {
      this.vocalVolume = volume;
    }
    this.applyTrackVolumes();
    this.volumeCallbacks.forEach(cb => cb(track, volume));
  }

  setPlaybackTransform(transform: PlaybackTransform): void {
    this.transform = transform;
    this.streamPlayer.setTransform(transform);
    this.headphonePlayer.setTransform(transform);
  }

  setOffset(offsetMs: number): void {
    // offsetMs > 0 => Delay Monitor (Headphone)
    // offsetMs < 0 => Delay Stream
    this.offsetMs = offsetMs;
    const abs = Math.abs(offsetMs) / 1000;

    if (offsetMs > 0) {
      this.headphonePlayer.setDelay(abs);
      this.streamPlayer.setDelay(0);
    } else {
      this.headphonePlayer.setDelay(0);
      this.streamPlayer.setDelay(abs);
    }

    if (this.activeMode === 'native' && this.isPlaying()) {
      this.seek(this.getCurrentTime());
    }
  }

  setLoop(loop: boolean): void {
    this.streamPlayer.loop = loop;
    this.headphonePlayer.loop = loop;
    this.nativeStreamPlayer.loop = loop;
    this.nativeHeadphonePlayer.loop = loop;
  }

  getPlaybackTransform(): PlaybackTransform {
    return this.transform;
  }

  dispose() {
    this.streamPlayer.dispose();
    this.headphonePlayer.dispose();
    this.nativeStreamPlayer.dispose();
    this.nativeHeadphonePlayer.dispose();
  }

  getSampleRate(role: OutputRole): number {
    return this.activeMode === 'native'
        ? (role === 'stream' ? this.nativeStreamPlayer.sampleRate : this.nativeHeadphonePlayer.sampleRate)
        : (role === 'stream' ? this.streamPlayer.sampleRate : this.headphonePlayer.sampleRate);
  }

  getVolume(role: OutputRole): number {
    return this.activeMode === 'native'
        ? (role === 'stream' ? this.nativeStreamPlayer.volume : this.nativeHeadphonePlayer.volume)
        : (role === 'stream' ? this.streamPlayer.volume : this.headphonePlayer.volume);
  }

  getTrackVolume(track: TrackType): number {
    return track === 'instrumental' ? this.instrVolume : this.vocalVolume;
  }

  private getResolvedOutputGains() {
    return resolveOutputGains({
      streamDeviceId: this.streamDeviceId,
      headphoneDeviceId: this.headphoneDeviceId,
      streamOutputGain: this.streamOutputGain,
      headphoneOutputGain: this.headphoneOutputGain,
    });
  }

  private getNativeCompletionRole(): OutputRole {
    const outputGains = this.getResolvedOutputGains();
    const dualOutputAudible = outputGains.stream > 0 && outputGains.headphone > 0;
    return resolveNativeCompletionRole(this.offsetMs, dualOutputAudible);
  }
}

const audioEngine: AudioEngine = new DualAudioEngine();

export default audioEngine;
