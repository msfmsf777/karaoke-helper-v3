import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface WaveformTrimTrackProps {
  audioUrl: string | null;
  duration: number;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  onTrimStartChange: (val: number) => void;
  onTrimEndChange: (val: number) => void;
  onSeek?: (seconds: number) => void;
  lyricTimestamps?: number[];
  height?: number;
}

export const WaveformTrimTrack: React.FC<WaveformTrimTrackProps> = ({
  audioUrl,
  duration,
  trimStart,
  trimEnd,
  currentTime,
  onTrimStartChange,
  onTrimEndChange,
  onSeek,
  lyricTimestamps = [],
  height = 80,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loadingPeaks, setLoadingPeaks] = useState(false);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  // Decode and extract waveform peaks
  useEffect(() => {
    if (!audioUrl) {
      setPeaks([]);
      return;
    }

    let cancelled = false;
    setLoadingPeaks(true);

    const extractPeaks = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          audioCtx.close();
          return;
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleCount = 240; // Number of vertical bars
        const step = Math.floor(channelData.length / sampleCount);
        const extracted: number[] = [];

        for (let i = 0; i < sampleCount; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, channelData.length);
          for (let j = start; j < end; j += 4) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          extracted.push(max);
        }

        // Normalize peaks
        const maxPeak = Math.max(...extracted, 0.01);
        const normalized = extracted.map(p => Math.min(1, p / maxPeak));

        if (!cancelled) {
          setPeaks(normalized);
        }
        audioCtx.close();
      } catch (err) {
        console.warn('[WaveformTrimTrack] Failed to extract peaks', err);
        // Fallback default peak curve
        if (!cancelled) {
          setPeaks(Array.from({ length: 180 }, (_, i) => 0.2 + 0.6 * Math.sin((i / 180) * Math.PI)));
        }
      } finally {
        if (!cancelled) {
          setLoadingPeaks(false);
        }
      }
    };

    extractPeaks();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, width, h);

    const effectiveDuration = duration > 0 ? duration : 1;
    const startRatio = Math.max(0, Math.min(1, trimStart / effectiveDuration));
    const endRatio = Math.max(startRatio, Math.min(1, trimEnd / effectiveDuration));
    const currentRatio = Math.max(0, Math.min(1, currentTime / effectiveDuration));

    const startX = startRatio * width;
    const endX = endRatio * width;
    const playheadX = currentRatio * width;

    // Background track
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, width, h);

    // Excluded left zone (dimmed)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, startX, h);

    // Excluded right zone (dimmed)
    ctx.fillRect(endX, 0, width - endX, h);

    // Active zone background highlight
    ctx.fillStyle = 'rgba(30, 215, 96, 0.05)';
    ctx.fillRect(startX, 0, endX - startX, h);

    // Draw waveform bars
    const barCount = peaks.length || 180;
    const barWidth = Math.max(1, (width / barCount) - 1);

    for (let i = 0; i < barCount; i++) {
      const peak = peaks[i] ?? 0.3;
      const barH = Math.max(3, peak * (h - 20));
      const x = (i / barCount) * width;
      const y = (h - barH) / 2;

      const isInActiveRange = x >= startX && x <= endX;
      if (isInActiveRange) {
        ctx.fillStyle = '#1ed760'; // Active region bright green
      } else {
        ctx.fillStyle = '#444444'; // Excluded region dimmed gray
      }

      ctx.fillRect(x, y, barWidth, barH);
    }

    // Draw Lyric presence strip at the bottom (4px height)
    const stripY = h - 6;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, stripY, width, 5);

    if (lyricTimestamps.length > 0) {
      for (const t of lyricTimestamps) {
        const lx = (t / effectiveDuration) * width;
        const isCut = t < trimStart;
        ctx.fillStyle = isCut ? '#ff5252' : '#a78bfa';
        ctx.fillRect(Math.max(0, lx - 1), stripY, 3, 5);
      }
    }

    // Playhead line
    if (currentTime > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
    }

    // Start handle line
    ctx.strokeStyle = '#1ed760';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.stroke();

    // Start handle top flag
    ctx.fillStyle = '#1ed760';
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + 9, 0);
    ctx.lineTo(startX + 9, 14);
    ctx.lineTo(startX, 18);
    ctx.closePath();
    ctx.fill();

    // End handle line
    ctx.strokeStyle = '#1ed760';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();

    // End handle top flag
    ctx.fillStyle = '#1ed760';
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX - 9, 0);
    ctx.lineTo(endX - 9, 14);
    ctx.lineTo(endX, 18);
    ctx.closePath();
    ctx.fill();

  }, [peaks, duration, trimStart, trimEnd, currentTime, lyricTimestamps, height]);

  // Resize canvas when container size changes
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = height;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  const getTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    return ratio * (duration > 0 ? duration : 1);
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const startX = (trimStart / duration) * rect.width;
    const endX = (trimEnd / duration) * rect.width;

    const hitThreshold = 14;
    if (Math.abs(x - startX) <= hitThreshold) {
      draggingRef.current = 'start';
    } else if (Math.abs(x - endX) <= hitThreshold) {
      draggingRef.current = 'end';
    } else {
      // Seek on background click
      const clickTime = getTimeFromMouseEvent(e);
      onSeek?.(clickTime);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const t = getTimeFromMouseEvent(e);
      if (draggingRef.current === 'start') {
        const newStart = Math.min(t, trimEnd - 0.5);
        onTrimStartChange(Math.max(0, Math.round(newStart * 100) / 100));
      } else if (draggingRef.current === 'end') {
        const newEnd = Math.max(t, trimStart + 0.5);
        onTrimEndChange(Math.min(duration, Math.round(newEnd * 100) / 100));
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [duration, trimStart, trimEnd, getTimeFromMouseEvent, onTrimStartChange, onTrimEndChange]);

  // Count lyrics cut by current trimStart
  const cutLyricsCount = lyricTimestamps.filter(t => t < trimStart).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          width: '100%',
          height: `${height}px`,
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1px solid #333',
          userSelect: 'none',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        {loadingPeaks && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontSize: '11px',
            color: '#888',
            pointerEvents: 'none',
          }}>
            ...
          </div>
        )}
      </div>

      {/* Non-disruptive minimal warning if lyrics are cut */}
      {cutLyricsCount > 0 && (
        <div style={{
          fontSize: '12px',
          color: '#ffb74d',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>⚠️</span>
          <span>{t('songManagement.editDialog.waveformTrimCutWarning', { count: cutLyricsCount, defaultValue: `${cutLyricsCount} synced lyric line(s) fall inside the trimmed intro section` })}</span>
        </div>
      )}
    </div>
  );
};
