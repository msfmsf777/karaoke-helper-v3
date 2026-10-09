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

export function useTrimAuditionPlayer(songId: string | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSnippet, setActiveSnippet] = useState<AuditionSnippetType>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const stop = useCallback(() => {
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

  const playSnippet = useCallback((startSeconds: number, durationSeconds: number, type: AuditionSnippetType = 'manual') => {
    stop();
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, startSeconds);
    audio.play()
      .then(() => {
        setIsPlaying(true);
        setActiveSnippet(type);
        stopTimeoutRef.current = setTimeout(() => {
          stop();
        }, durationSeconds * 1000);
      })
      .catch((err) => {
        console.warn('[useTrimAuditionPlayer] Playback failed', err);
        stop();
      });
  }, [stop]);

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
    activeSnippet,
    playSnippet,
    seek,
    stop,
    audioUrl,
  };
}
