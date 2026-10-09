#!/usr/bin/env python3
"""
Vocal Range Analyzer for Karaoke Helper
Extracts the effective vocal range (lowest and highest notes) from an isolated vocal audio file.
Uses ffmpeg for stream decoding and YIN algorithm with numpy for robust fundamental frequency tracking.
"""

import sys
import os
import json
import argparse
import subprocess
import math
from pathlib import Path

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def midi_to_note_name(midi_val):
    rounded = int(round(midi_val))
    note_idx = (rounded % 12 + 12) % 12
    octave = (rounded // 12) - 1
    return f"{NOTE_NAMES[note_idx]}{octave}"

def load_audio_via_ffmpeg(audio_path, ffmpeg_bin=None, target_sr=16000):
    """
    Decodes audio into 16kHz mono float32 numpy array using ffmpeg.
    """
    import numpy as np

    if not ffmpeg_bin or not os.path.exists(ffmpeg_bin):
        # Fallback to system ffmpeg
        ffmpeg_bin = 'ffmpeg'

    cmd = [
        ffmpeg_bin,
        '-v', 'error',
        '-i', str(audio_path),
        '-f', 'f32le',
        '-ac', '1',
        '-ar', str(target_sr),
        '-'
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        raw_bytes = proc.stdout
        if not raw_bytes:
            return None, target_sr
        samples = np.frombuffer(raw_bytes, dtype=np.float32)
        return samples, target_sr
    except Exception as e:
        sys.stderr.write(f"ffmpeg decode error: {e}\n")
        return None, target_sr

def compute_yin_pitch(audio, sr=16000, frame_size=1024, hop_size=512, min_f0=65.0, max_f0=1050.0, threshold=0.15):
    """
    Vectorized YIN pitch detection on audio frames.
    Returns list of detected fundamental frequencies (in Hz).
    """
    import numpy as np

    tau_min = int(sr / max_f0)
    tau_max = int(sr / min_f0)

    n_samples = len(audio)
    if n_samples < frame_size:
        return []

    num_frames = (n_samples - frame_size) // hop_size + 1
    voiced_pitches = []

    # Process in chunks or frame by frame
    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start:start + frame_size]

        # RMS Energy check (skip silence / background breathing)
        rms = np.sqrt(np.mean(frame ** 2))
        if rms < 0.015:
            continue

        # Step 1: Difference function
        # d_t(tau) = sum_{j=1}^W (x_j - x_{j+tau})^2
        w_size = frame_size // 2
        w = frame[:w_size]
        
        diff = np.zeros(tau_max + 1, dtype=np.float32)
        for tau in range(tau_min, tau_max + 1):
            w_tau = frame[tau:tau + w_size]
            diff[tau] = np.sum((w - w_tau) ** 2)

        # Step 2: Cumulative mean normalized difference
        # d'_t(tau) = diff[tau] / ( (1/tau) * sum_{j=1}^tau diff[j] )
        cmnd = np.ones(tau_max + 1, dtype=np.float32)
        running_sum = 0.0
        for tau in range(1, tau_max + 1):
            running_sum += diff[tau]
            if running_sum > 0:
                cmnd[tau] = diff[tau] / (running_sum / tau)

        # Step 3: Absolute threshold
        best_tau = None
        for tau in range(tau_min, tau_max):
            if cmnd[tau] < threshold:
                # Find local minimum
                while tau + 1 < tau_max and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                best_tau = tau
                break

        # If no dip below threshold, check global minimum below 0.25
        if best_tau is None:
            sub_cmnd = cmnd[tau_min:tau_max + 1]
            min_val = np.min(sub_cmnd)
            if min_val < 0.25:
                best_tau = tau_min + int(np.argmin(sub_cmnd))

        if best_tau is not None and best_tau > 0:
            # Parabolic interpolation for fine tuning
            tau_fine = float(best_tau)
            if 0 < best_tau < tau_max:
                s0 = cmnd[best_tau - 1]
                s1 = cmnd[best_tau]
                s2 = cmnd[best_tau + 1]
                denom = (s0 - 2 * s1 + s2)
                if abs(denom) > 1e-6:
                    tau_fine = best_tau + 0.5 * (s0 - s2) / denom

            f0 = sr / tau_fine
            if min_f0 <= f0 <= max_f0:
                voiced_pitches.append(f0)

    return voiced_pitches

def analyze_vocal_range(audio_path, ffmpeg_bin=None):
    import numpy as np

    samples, sr = load_audio_via_ffmpeg(audio_path, ffmpeg_bin)
    if samples is None or len(samples) == 0:
        return {"error": "Failed to decode audio file"}

    f0_list = compute_yin_pitch(samples, sr)

    if len(f0_list) < 15:
        return {"error": "Insufficient voiced vocal segments detected"}

    # Convert Hz to MIDI
    midi_pitches = [69.0 + 12.0 * math.log2(f / 440.0) for f in f0_list]
    midi_pitches.sort()

    # Percentile filtering (P5 to P95) to eliminate vocal fry / laughing / screams
    p5 = float(np.percentile(midi_pitches, 5))
    p95 = float(np.percentile(midi_pitches, 95))

    low_midi = int(round(p5))
    high_midi = int(round(p95))

    # Clamp sanity check
    if high_midi < low_midi:
        high_midi = low_midi

    return {
        "status": "success",
        "lowestMidi": low_midi,
        "highestMidi": high_midi,
        "lowestNote": midi_to_note_name(low_midi),
        "highestNote": midi_to_note_name(high_midi),
        "totalVoicedFrames": len(f0_list)
    }

def main():
    parser = argparse.ArgumentParser(description="Analyze vocal range from isolated vocal audio")
    parser.add_argument("--input", required=True, help="Input vocal audio path")
    parser.add_argument("--ffmpeg", help="Path to ffmpeg executable")
    args = parser.parse_args()

    input_file = Path(args.input)
    if not input_file.exists():
        print(json.dumps({"error": f"File not found: {args.input}"}))
        sys.exit(1)

    result = analyze_vocal_range(str(input_file), args.ffmpeg)
    print(json.dumps(result))
    if "error" in result:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
