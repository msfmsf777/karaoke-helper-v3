import { useEffect, useRef } from 'react';
import { useQueue } from '../../contexts/QueueContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { useUserData } from '../../contexts/UserDataContext';
import audioEngine from '../../audio/AudioEngine';

interface MiniPlayerState {
    currentTrack: {
        title: string;
        artist: string;
        duration: number;
    } | null;
    isPlaying: boolean;
    currentTime: number;
    volume: {
        instrumental: number;
        vocal: number;
        instrumentalMuted: boolean;
        vocalMuted: boolean;
    };
    speed: number;
    pitch: number;
    queue: {
        id: string;
        title: string;
        artist: string;
    }[];
    currentIndex: number;
    isFavorite: boolean;
}

export default function MiniPlayerSync() {
    const {
        currentSongId,
        queue,
        currentIndex,
        playNext,
        playPrev,
        togglePlayPause,
        removeFromQueue,
        playQueueIndex
    } = useQueue();

    const { isFavorite, toggleFavorite } = useUserData();
    const { getSongById } = useLibrary();

    // Throttling ref
    const lastUpdateRef = useRef<number>(0);
    const rafRef = useRef<number>();

    // Helpers for Mute Toggle
    const toggleMute = (role: 'instrumental' | 'vocal') => {
        const current = role === 'instrumental'
            ? audioEngine.getTrackVolume('instrumental')
            : audioEngine.getTrackVolume('vocal');

        const target = current > 0 ? 0 : 1;
        audioEngine.setTrackVolume(role, target);
    };

    // Command Listener
    useEffect(() => {
        if (!window.khelper?.miniPlayer) return;

        const removeListener = window.khelper.miniPlayer.onCommand((command, ...args) => {
            // console.log('[MiniPlayerSync] Received command:', command, args);
            switch (command) {
                case 'playPause':
                    togglePlayPause();
                    break;
                case 'next':
                    playNext(true);
                    break;
                case 'prev':
                    playPrev();
                    break;
                case 'seek':
                    const [time] = args;
                    if (typeof time === 'number') {
                        audioEngine.seek(time);
                    }
                    break;
                case 'setSpeed':
                    const [speed] = args;
                    audioEngine.setPlaybackTransform({ ...audioEngine.getPlaybackTransform(), speed });
                    break;
                case 'setPitch':
                    const [pitch] = args;
                    audioEngine.setPlaybackTransform({ ...audioEngine.getPlaybackTransform(), transpose: pitch });
                    break;
                case 'setInstrumentalVolume':
                    const [instVol] = args;
                    audioEngine.setTrackVolume('instrumental', instVol);
                    break;
                case 'setVocalVolume':
                    const [vocVol] = args;
                    audioEngine.setTrackVolume('vocal', vocVol);
                    break;
                case 'toggleInstrumentalMute':
                    toggleMute('instrumental');
                    break;
                case 'toggleVocalMute':
                    toggleMute('vocal');
                    break;
                case 'toggleMainWindow':
                    // Handled by Main Process
                    break;
                case 'removeFromQueue':
                    // @ts-ignore
                    const [rmIdx] = args;
                    if (typeof rmIdx === 'number') removeFromQueue(rmIdx);
                    break;
                case 'playQueueIndex':
                    // @ts-ignore
                    const [qIdx] = args;
                    if (typeof qIdx === 'number') playQueueIndex(qIdx);
                    break;
                case 'toggleFavorite':
                    if (currentSongId) toggleFavorite(currentSongId);
                    break;
            }
        });

        return () => removeListener?.();
    }, [togglePlayPause, playNext, playPrev, removeFromQueue, playQueueIndex, currentSongId, toggleFavorite]);

    // State Broadcaster
    useEffect(() => {
        const broadcastState = () => {
            if (!window.khelper?.miniPlayer) return;

            const now = Date.now();
            if (now - lastUpdateRef.current < 30) {
                rafRef.current = requestAnimationFrame(broadcastState);
                return;
            }
            lastUpdateRef.current = now;

            // Construct State Snapshot
            const song = currentSongId ? getSongById(currentSongId) : null;

            const tf = audioEngine.getPlaybackTransform();

            const instVol = audioEngine.getTrackVolume('instrumental');
            const vocVol = audioEngine.getTrackVolume('vocal');

            const state: MiniPlayerState = {
                currentTrack: song ? {
                    title: song.title,
                    artist: song.artist || '',
                    duration: audioEngine.getDuration()
                } : null,
                isPlaying: audioEngine.isPlaying(),
                currentTime: audioEngine.getCurrentTime(),
                volume: {
                    instrumental: instVol,
                    vocal: vocVol,
                    instrumentalMuted: instVol === 0,
                    vocalMuted: vocVol === 0
                },
                speed: tf.speed,
                pitch: tf.transpose,
                queue: queue.slice(0, 20).map(id => {
                    const s = getSongById(id);
                    return { id, title: s?.title || 'Unknown', artist: s?.artist || '' };
                }),
                currentIndex: currentIndex,
                isFavorite: currentSongId ? isFavorite(currentSongId) : false
            };

            window.khelper.miniPlayer.sendStateUpdate(state);
        };

        const unsubTime = audioEngine.onTimeUpdate(broadcastState);
        const interval = setInterval(broadcastState, 500);

        // Initial broadcast
        broadcastState();

        return () => {
            unsubTime();
            clearInterval(interval);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [currentSongId, queue, getSongById, currentIndex, isFavorite]);

    return null;
}
