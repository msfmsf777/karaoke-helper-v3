import { useState, useEffect, useRef, useCallback } from 'react';
import { loadOutputDevicePreferences } from '../settings/devicePreferences';

function toFileUrl(filePath: string): string {
  if (filePath.startsWith('file://') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
}

export type AuditionSnippetType = 'in' | 'out' | 'manual' | null;

export interface UseTrimAuditionPlayerOptions {
  trimEnd?: number;
  initialVolume?: number;
}

export function useTrimAuditionPlayer(songId: string | null, options?: UseTrimAuditionPlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSnippet, setActiveSnippet] = useState<AuditionSnippetType>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof options?.initialVolume === 'number' && Number.isFinite(options.initialVolume)) {
      return Math.max(0, Math.min(1, options.initialVolume));
    }
    return 1.0;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trimEndRef = useRef<number | undefined>(options?.trimEnd);
  const volumeRef = useRef<number>(volume);

  useEffect(() => {
    trimEndRef.current = options?.trimEnd;
  }, [options?.trimEnd]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Fetch song file path and resolve URL
  useEffect(() => {
    let active = true;
    if (!songId) {
      setAudioUrl(null);
      return;
    }

    const loadPath = async () => {
      try {
        const filePath = await window.khelper?.songLibrary.getOriginalSongFilePath(songId)
          || await window.khelper?.songLibrary.getSongFilePath(songId);
        if (active && filePath) {
          setAudioUrl(toFileUrl(filePath));
        }
      } catch (err) {
        console.warn('[useTrimAuditionPlayer] Failed to load song path', songId, err);
      }
    };

    loadPath();
    return () => {
      active = false;
    };
  }, [songId]);

  // Initialize Audio element with strict headphone routing
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, volumeRef.current));
    audioRef.current = audio;

    // Apply configured headphone sink id to avoid stream bleed
    const prefs = loadOutputDevicePreferences();
    const sinkId = prefs?.headphoneDeviceId ?? '';
    const sinkable = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof sinkable.setSinkId === 'function') {
      sinkable.setSinkId(sinkId || '').catch((err) => {
        console.warn('[useTrimAuditionPlayer] Failed to set sinkId on preview audio', err);
      });
    }

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (
        trimEndRef.current !== undefined &&
        trimEndRef.current > 0 &&
        audio.currentTime >= trimEndRef.current
      ) {
        audio.pause();
        setIsPlaying(false);
        setActiveSnippet(null);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setActiveSnippet(null);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.src = '';
      audioRef.current = null;
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, [audioUrl]);

  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    volumeRef.current = clamped;
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const pause = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setActiveSnippet(null);
  }, []);

  const play = useCallback((startSeconds?: number, type: AuditionSnippetType = 'manual') => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (typeof startSeconds === 'number' && Number.isFinite(startSeconds)) {
      audio.currentTime = Math.max(0, startSeconds);
      setCurrentTime(audio.currentTime);
    }

    audio.play()
      .then(() => {
        setIsPlaying(true);
        setActiveSnippet(type);
      })
      .catch((err) => {
        console.warn('[useTrimAuditionPlayer] Playback failed', err);
        setIsPlaying(false);
        setActiveSnippet(null);
      });
  }, []);

  const togglePlayPause = useCallback((fallbackStartSeconds?: number) => {
    if (isPlaying) {
      pause();
    } else {
      play(fallbackStartSeconds);
    }
  }, [isPlaying, pause, play]);

  const playSnippet = useCallback((startSeconds: number, durationSeconds: number, type: AuditionSnippetType = 'manual') => {
    pause();
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, startSeconds);
    audio.play()
      .then(() => {
        setIsPlaying(true);
        setActiveSnippet(type);
        stopTimeoutRef.current = setTimeout(() => {
          pause();
        }, durationSeconds * 1000);
      })
      .catch((err) => {
        console.warn('[useTrimAuditionPlayer] Playback failed', err);
        pause();
      });
  }, [pause]);

  const seek = useCallback((positionSeconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = positionSeconds;
      setCurrentTime(positionSeconds);
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    activeSnippet,
    play,
    pause,
    togglePlayPause,
    playSnippet,
    seek,
    stop: pause,
    audioUrl,
  };
}
