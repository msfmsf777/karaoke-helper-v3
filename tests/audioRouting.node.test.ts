import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  areOutputDevicesOverlapping,
  resolveNativeCompletionRole,
  resolveNativeStartDelays,
  resolveOutputGains,
} from '../src/audio/outputRouting.ts';
import { NativeAudioPlayer } from '../src/audio/NativeAudioPlayer.ts';

type Listener = () => void;

class FakeAudio {
  src = '';
  crossOrigin = '';
  currentTime = 0;
  duration = 240;
  paused = true;
  volume = 1;
  playCount = 0;
  onended: (() => void) | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();

  load() {}

  async play() {
    this.paused = false;
    this.playCount += 1;
  }

  pause() {
    this.paused = true;
  }

  async setSinkId() {}

  addEventListener(name: string, listener: Listener) {
    const listeners = this.listeners.get(name) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name: string, listener: Listener) {
    this.listeners.get(name)?.delete(listener);
  }

  emit(name: string) {
    this.listeners.get(name)?.forEach((listener) => listener());
  }
}

describe('output route resolution', () => {
  it('treats system default destinations as overlapping', () => {
    assert.equal(areOutputDevicesOverlapping(null, null), true);
    assert.equal(areOutputDevicesOverlapping('', 'default'), true);
  });

  it('keeps disabled stream output silent after track volume changes', () => {
    const routing = resolveOutputGains({
      streamDeviceId: 'stream-device',
      headphoneDeviceId: 'headphone-device',
      streamOutputGain: 0,
      headphoneOutputGain: 1,
    });

    assert.deepEqual(routing, {
      stream: 0,
      headphone: 1,
      streamSuppressedForOverlap: false,
    });
    assert.equal(routing.stream * 0.65, 0);
    assert.equal(routing.headphone * 0.65, 0.65);
  });

  it('suppresses the stream route when audible destinations overlap', () => {
    assert.deepEqual(resolveOutputGains({
      streamDeviceId: null,
      headphoneDeviceId: null,
      streamOutputGain: 1,
      headphoneOutputGain: 1,
    }), {
      stream: 0,
      headphone: 1,
      streamSuppressedForOverlap: true,
    });
  });

  it('allows dual output when distinct devices are configured', () => {
    assert.deepEqual(resolveOutputGains({
      streamDeviceId: 'stream-device',
      headphoneDeviceId: 'headphone-device',
      streamOutputGain: 1,
      headphoneOutputGain: 1,
    }), {
      stream: 1,
      headphone: 1,
      streamSuppressedForOverlap: false,
    });
  });

  it('delays the calibrated route only when both native outputs are audible', () => {
    assert.deepEqual(resolveNativeStartDelays(80, true), { stream: 0, headphone: 80 });
    assert.deepEqual(resolveNativeStartDelays(-70, true), { stream: 70, headphone: 0 });
    assert.deepEqual(resolveNativeStartDelays(80, false), { stream: 0, headphone: 0 });
  });

  it('waits for the later audible native route before ending playback', () => {
    assert.equal(resolveNativeCompletionRole(80, true), 'headphone');
    assert.equal(resolveNativeCompletionRole(-70, true), 'stream');
    assert.equal(resolveNativeCompletionRole(-70, false), 'headphone');
  });
});

describe('NativeAudioPlayer', () => {
  it('does not finish loading until the native element is ready', async () => {
    const element = new FakeAudio();
    const player = new NativeAudioPlayer('stream', element as unknown as HTMLAudioElement);
    let resolved = false;
    const loading = player.loadUrl('https://example.test/audio').then(() => {
      resolved = true;
    });

    await Promise.resolve();
    assert.equal(resolved, false);

    element.emit('canplay');
    await loading;

    assert.equal(resolved, true);
  });

  it('can prime a muted route without waiting for readiness', async () => {
    const element = new FakeAudio();
    const player = new NativeAudioPlayer('stream', element as unknown as HTMLAudioElement);
    let resolved = false;

    player.loadUrl('https://example.test/audio', false).then(() => {
      resolved = true;
    });
    await Promise.resolve();

    assert.equal(resolved, true);
  });

  it('supports delayed starts and clears a pending start when paused', async () => {
    const element = new FakeAudio();
    const player = new NativeAudioPlayer('headphone', element as unknown as HTMLAudioElement);

    player.play(5);
    assert.equal(element.playCount, 0);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(element.playCount, 1);

    player.pause();
    player.play(10);
    player.pause();
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(element.playCount, 1);
  });
});
