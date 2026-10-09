import { loadOutputDevicePreferences } from '../settings/devicePreferences';

interface AudioContextWithSinkId extends AudioContext {
  setSinkId?: (sinkId: string) => Promise<void>;
}

let synthContext: AudioContextWithSinkId | null = null;

function getSynthContext(): AudioContextWithSinkId {
  if (!synthContext || synthContext.state === 'closed') {
    synthContext = new AudioContext({ latencyHint: 'interactive' }) as AudioContextWithSinkId;
  }
  if (synthContext.state === 'suspended') {
    void synthContext.resume();
  }

  // Update output sink to user's headphone device
  const prefs = loadOutputDevicePreferences();
  const headphoneSinkId = prefs?.headphoneDeviceId;
  if (synthContext.setSinkId && typeof synthContext.setSinkId === 'function') {
    const targetSink = headphoneSinkId && headphoneSinkId !== 'default' ? headphoneSinkId : '';
    synthContext.setSinkId(targetSink).catch(() => {});
  }

  return synthContext;
}

/**
 * Plays a warm, acoustic electric-piano tone for a given MIDI note.
 * Routes strictly through the headphone/monitor audio device.
 */
export function playSynthNote(midiNote: number, duration: number = 0.8): void {
  try {
    const ctx = getSynthContext();
    const now = ctx.currentTime;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Master gain for this note
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.25, now + 0.01); // Quick attack
    masterGain.gain.exponentialRampToValueAtTime(0.08, now + 0.2); // Decay
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // Release
    masterGain.connect(ctx.destination);

    // Fundamental (Warm Sine)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // 2nd Harmonic (Subtle octave overtone)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.5);

    // 3rd Harmonic (Subtle bell bite)
    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.15, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    // Connections
    osc1.connect(masterGain);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc3.connect(gain3);
    gain3.connect(masterGain);

    // Trigger
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    const stopTime = now + duration + 0.05;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);

    setTimeout(() => {
      try {
        masterGain.disconnect();
      } catch {}
    }, (duration + 0.1) * 1000);
  } catch (err) {
    console.warn('[SynthTone] Failed to play tone', err);
  }
}
