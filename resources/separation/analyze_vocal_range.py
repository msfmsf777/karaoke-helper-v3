#!/usr/bin/env python3
"""
Vocal Range Analyzer V2 for Karaoke Helper
Extracts effective vocal range (lowest and highest notes) and evidence timestamps
from an isolated vocal audio file.

Architecture:
- FFT-accelerated multi-candidate YIN (K=5 candidate minima + unvoiced state)
- Subharmonic & octave-doubling spectral validation
- Context-aware Viterbi DP path decoding with intra-vowel octave barrier & onset handling
- Late-quantized note-level segmentation with duration saturation & energy gating
- Evidence metadata extraction (numerical timestamp, duration, pitch, confidence)
- Output includes analysisVersion: 2
"""

import sys
import os
import json
import argparse
import subprocess
import math
import time
import numpy as np
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
    if not ffmpeg_bin or not os.path.exists(ffmpeg_bin):
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

def analyze_vocal_range_v2(audio, sr=16000, K=5):
    """
    V2 Probabilistic Multi-Candidate YIN + Viterbi Vocal Range Extractor.
    """
    t_start = time.time()
    frame_len = 1024
    hop_len = 256  # 16ms hop
    W = 512
    min_f0 = 65.0
    max_f0 = 1050.0
    tau_min = int(sr / max_f0)  # ~15
    tau_max = int(sr / min_f0)  # ~246

    n_samples = len(audio)
    if n_samples < frame_len:
        return {"error": "Audio file too short for pitch analysis"}

    num_frames = (n_samples - frame_len) // hop_len + 1
    hop_dur = hop_len / sr

    # Step 1: Pre-slice frames and RMS energy
    frames = np.lib.stride_tricks.as_strided(
        audio,
        shape=(num_frames, frame_len),
        strides=(audio.strides[0] * hop_len, audio.strides[0])
    )
    rms_arr = np.sqrt(np.mean(frames[:, :W] ** 2, axis=1))
    p90_rms = float(np.percentile(rms_arr, 90)) if len(rms_arr) > 0 else 0.05
    energy_thresh = max(0.012, p90_rms * 0.08)

    # Step 2: FFT Cross-correlation & Difference Function
    n_fft = 2048
    w_rev = np.zeros((num_frames, n_fft), dtype=np.float32)
    w_rev[:, :W] = frames[:, :W][:, ::-1]

    v = np.zeros((num_frames, n_fft), dtype=np.float32)
    v[:, :W + tau_max] = frames[:, :W + tau_max]

    block_size = 2048
    r_fft = np.zeros((num_frames, tau_max + 1), dtype=np.float32)
    for b_start in range(0, num_frames, block_size):
        b_end = min(num_frames, b_start + block_size)
        W_f = np.fft.rfft(w_rev[b_start:b_end], axis=-1)
        V_f = np.fft.rfft(v[b_start:b_end], axis=-1)
        conv = np.fft.irfft(V_f * W_f, n=n_fft, axis=-1)
        r_fft[b_start:b_end] = conv[:, W - 1 : W + tau_max]

    frame_sq = frames ** 2
    cum_sq = np.pad(np.cumsum(frame_sq, axis=1), ((0, 0), (1, 0)), mode='constant')
    tau_indices = np.arange(tau_max + 1)
    P_tau = cum_sq[:, tau_indices + W] - cum_sq[:, tau_indices]
    P_0 = P_tau[:, 0:1]

    d_arr = np.maximum(0.0, P_0 + P_tau - 2.0 * r_fft)

    # CMNDF calculation
    d_cumsum = np.cumsum(d_arr[:, 1:], axis=1)
    tau_scales = np.arange(1, tau_max + 1, dtype=np.float32)
    norm = d_cumsum / tau_scales

    cmndf_arr = np.ones((num_frames, tau_max + 1), dtype=np.float32)
    mask = norm > 1e-7
    cmndf_arr[:, 1:][mask] = d_arr[:, 1:][mask] / norm[mask]

    # Pre-compute FFT magnitudes for fast spectral peak checking
    fft_mag = np.abs(np.fft.rfft(frames, n=1024, axis=-1))

    # Base unvoiced cost (softplus around threshold 0.22)
    UNVOICED_BASE_COST = float(np.log(1.0 + np.exp(10.0 * (0.22 - 0.25))))

    # Step 3: Multi-Candidate Extraction & Observation Cost
    NUM_STATES = K + 1
    candidates_midi = np.zeros((num_frames, NUM_STATES), dtype=np.float32)
    candidates_cmndf = np.ones((num_frames, NUM_STATES), dtype=np.float32)
    candidates_obs = np.full((num_frames, NUM_STATES), 10.0, dtype=np.float32)

    # Candidate K is Unvoiced state
    candidates_midi[:, K] = -1.0
    candidates_cmndf[:, K] = 1.0

    for i in range(num_frames):
        c_curve = cmndf_arr[i]
        rms = rms_arr[i]
        mag_i = fft_mag[i]

        if rms < energy_thresh:
            candidates_obs[i, K] = UNVOICED_BASE_COST * 0.1
            continue
        else:
            candidates_obs[i, K] = UNVOICED_BASE_COST

        sub = c_curve[tau_min - 1 : tau_max + 2]
        is_min = (sub[1:-1] < sub[:-2]) & (sub[1:-1] < sub[2:])
        min_taus = np.where(is_min)[0] + tau_min

        if len(min_taus) == 0:
            continue

        raw_candidates = []
        for tau in min_taus:
            s0 = c_curve[tau - 1]
            s1 = c_curve[tau]
            s2 = c_curve[tau + 1]
            denom = s0 - 2.0 * s1 + s2
            delta = 0.5 * (s0 - s2) / denom if abs(denom) > 1e-6 else 0.0
            tau_fine = tau + delta
            val_fine = max(0.0, s1 - 0.25 * (s0 - s2) * delta)
            hz = sr / max(1.0, tau_fine)
            raw_candidates.append((tau_fine, hz, val_fine))

        cand_list = []
        for tau_f, hz, val_f in raw_candidates:
            # Numerically stable softplus observation cost
            arg = 10.0 * (val_f - 0.25)
            cost = math.log1p(math.exp(arg)) if arg < 20.0 else arg

            # 1. Subharmonic ghost validation (if candidate < 300Hz, check upper harmonics)
            if hz < 300.0:
                bin_c = int(round(hz * 1024 / sr))
                bin_c = max(0, min(512, bin_c))
                mag_c = max(float(mag_i[max(0, bin_c - 2)]), float(mag_i[bin_c]), float(mag_i[min(512, bin_c + 2)]))
                for k in (2, 3, 4, 5, 6, 7, 8):
                    fk = k * hz
                    if fk > 1050.0:
                        break
                    bin_k = int(round(fk * 1024 / sr))
                    bin_k = max(0, min(512, bin_k))
                    mag_k = max(float(mag_i[max(0, bin_k - 2)]), float(mag_i[bin_k]), float(mag_i[min(512, bin_k + 2)]))
                    if mag_k > 3.0 * max(0.2, mag_c):
                        cost += 3.5  # Subharmonic penalty
                        break

            # 2. Octave doubling validation (if candidate > 500Hz, check subharmonic half)
            if hz > 500.0:
                f_half = hz / 2.0
                bin_h = int(round(f_half * 1024 / sr))
                bin_h = max(0, min(512, bin_h))
                mag_h = max(float(mag_i[max(0, bin_h - 2)]), float(mag_i[bin_h]), float(mag_i[min(512, bin_h + 2)]))
                bin_c = int(round(hz * 1024 / sr))
                bin_c = max(0, min(512, bin_c))
                mag_c = max(float(mag_i[max(0, bin_c - 2)]), float(mag_i[bin_c]), float(mag_i[min(512, bin_c + 2)]))
                if mag_h > 1.8 * max(0.2, mag_c):
                    cost += 3.5

            midi = 69.0 + 12.0 * math.log2(max(1.0, hz) / 440.0)
            cand_list.append((midi, val_f, cost))

        cand_list.sort(key=lambda x: x[2])
        for idx, (m, c_val, c_cost) in enumerate(cand_list[:K]):
            candidates_midi[i, idx] = m
            candidates_cmndf[i, idx] = c_val
            candidates_obs[i, idx] = c_cost

    # Step 4: Viterbi DP Path Decoding
    dp = np.zeros((num_frames, NUM_STATES), dtype=np.float32)
    backpointers = np.zeros((num_frames, NUM_STATES), dtype=np.int32)
    dp[0] = candidates_obs[0]

    BOUNDARY_COST = 0.7
    OCTAVE_PENALTY = 3.5

    for t in range(1, num_frames):
        prev_m = candidates_midi[t - 1]
        curr_m = candidates_midi[t]

        T_cost = np.zeros((NUM_STATES, NUM_STATES), dtype=np.float32)
        T_cost[K, K] = 0.0
        T_cost[:K, K] = BOUNDARY_COST
        T_cost[K, :K] = BOUNDARY_COST

        p_prev = prev_m[:K, np.newaxis]
        p_curr = curr_m[np.newaxis, :K]
        invalid_mask = (p_prev <= 0) | (p_curr <= 0)

        diff = np.abs(p_curr - p_prev)
        v2v_cost = 0.04 * diff

        # Gaussian octave penalty barrier around 12 and 24 semitones
        oct1_dist = np.abs(diff - 12.0)
        oct2_dist = np.abs(diff - 24.0)
        oct_pen = OCTAVE_PENALTY * (np.exp(-0.5 * (oct1_dist / 1.5) ** 2) + np.exp(-0.5 * (oct2_dist / 1.5) ** 2))
        v2v_cost += oct_pen
        v2v_cost[invalid_mask] = 100.0

        T_cost[:K, :K] = v2v_cost

        total_costs = dp[t - 1, :, np.newaxis] + T_cost
        best_prev = np.argmin(total_costs, axis=0)
        dp[t] = total_costs[best_prev, np.arange(NUM_STATES)] + candidates_obs[t]
        backpointers[t] = best_prev

    best_path = np.zeros(num_frames, dtype=np.int32)
    best_path[-1] = int(np.argmin(dp[-1]))
    for t in range(num_frames - 2, -1, -1):
        best_path[t] = backpointers[t + 1, best_path[t + 1]]

    path_midi = np.array([
        candidates_midi[t, best_path[t]] if best_path[t] < K and candidates_midi[t, best_path[t]] > 0 else None
        for t in range(num_frames)
    ], dtype=object)

    path_cmndf = np.array([
        candidates_cmndf[t, best_path[t]] if best_path[t] < K else 1.0
        for t in range(num_frames)
    ], dtype=np.float32)

    # Step 5: Note-Level Segmentation
    notes = []
    curr_frames = []

    for t in range(num_frames):
        m = path_midi[t]
        if m is not None:
            if not curr_frames:
                curr_frames.append((t, m, path_cmndf[t], rms_arr[t]))
            else:
                med = np.median([x[1] for x in curr_frames])
                if abs(m - med) <= 0.8:
                    curr_frames.append((t, m, path_cmndf[t], rms_arr[t]))
                else:
                    dur = len(curr_frames) * hop_dur
                    if dur >= 0.08:
                        notes.append(curr_frames)
                    curr_frames = [(t, m, path_cmndf[t], rms_arr[t])]
        else:
            if curr_frames:
                dur = len(curr_frames) * hop_dur
                if dur >= 0.08:
                    notes.append(curr_frames)
                curr_frames = []
    if curr_frames:
        dur = len(curr_frames) * hop_dur
        if dur >= 0.08:
            notes.append(curr_frames)

    scored_notes = []
    for n_frames in notes:
        start_time = n_frames[0][0] * hop_dur
        dur = len(n_frames) * hop_dur
        midis = [x[1] for x in n_frames]
        cmndfs = [x[2] for x in n_frames]
        rmss = [x[3] for x in n_frames]

        median_midi = float(np.median(midis))
        median_cmndf = float(np.median(cmndfs))
        mean_rms = float(np.mean(rmss))

        frame_conf = max(0.0, 1.0 - median_cmndf / 0.4)
        dur_sat = min(1.0, dur / 0.15)
        energy_sat = min(1.0, mean_rms / (energy_thresh * 1.5))
        note_conf = frame_conf * dur_sat * energy_sat

        scored_notes.append({
            "timestamp": round(start_time, 2),
            "duration": round(dur, 2),
            "midi": round(median_midi, 2),
            "note": midi_to_note_name(median_midi),
            "confidence": round(note_conf, 3),
            "rms": round(mean_rms, 4)
        })

    if not scored_notes:
        return {"error": "Insufficient voiced vocal segments detected"}

    # Dynamic median-energy baseline to filter out breathy whisper tails / guitar spill
    med_note_rms = float(np.median([n["rms"] for n in scored_notes]))
    min_credible_rms = med_note_rms * 0.35

    credible_notes = [
        n for n in scored_notes
        if n["confidence"] >= 0.45 and n["rms"] >= min_credible_rms and n["duration"] >= 0.10
    ]

    if len(credible_notes) < 3:
        # Graceful fallback for songs with shorter/quieter notes
        credible_notes = [
            n for n in scored_notes
            if n["confidence"] >= 0.35 and n["duration"] >= 0.08
        ]

    if not credible_notes:
        credible_notes = scored_notes

    credible_notes_by_pitch = sorted(credible_notes, key=lambda x: x["midi"])
    lowest = credible_notes_by_pitch[0]
    highest = credible_notes_by_pitch[-1]

    elapsed = time.time() - t_start

    return {
        "status": "success",
        "analysisVersion": 2,
        "lowestMidi": int(round(lowest["midi"])),
        "highestMidi": int(round(highest["midi"])),
        "lowestNote": lowest["note"],
        "highestNote": highest["note"],
        "lowestNoteEvidence": {
            "note": lowest["note"],
            "midi": int(round(lowest["midi"])),
            "timestamp": lowest["timestamp"],
            "duration": lowest["duration"],
            "confidence": lowest["confidence"]
        },
        "highestNoteEvidence": {
            "note": highest["note"],
            "midi": int(round(highest["midi"])),
            "timestamp": highest["timestamp"],
            "duration": highest["duration"],
            "confidence": highest["confidence"]
        },
        "totalNotes": len(scored_notes),
        "credibleNotes": len(credible_notes),
        "elapsedSeconds": round(elapsed, 3)
    }

def main():
    parser = argparse.ArgumentParser(description="Vocal Range Analysis V2")
    parser.add_argument("--input", required=True, help="Input vocal audio path")
    parser.add_argument("--ffmpeg", help="Path to ffmpeg executable")
    args = parser.parse_args()

    input_file = Path(args.input)
    if not input_file.exists():
        print(json.dumps({"error": f"File not found: {args.input}"}))
        sys.exit(1)

    samples, sr = load_audio_via_ffmpeg(str(input_file), args.ffmpeg)
    if samples is None or len(samples) == 0:
        print(json.dumps({"error": "Failed to decode audio file"}))
        sys.exit(1)

    result = analyze_vocal_range_v2(samples, sr)
    print(json.dumps(result))
    if "error" in result:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
