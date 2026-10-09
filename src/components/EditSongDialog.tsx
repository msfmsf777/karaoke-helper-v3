import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SongMeta } from '../../shared/songTypes';
import { useLibrary } from '../contexts/LibraryContext';
import audioEngine from '../audio/AudioEngine';
import { useTrimAuditionPlayer } from '../audio/useTrimAuditionPlayer';
import { WaveformTrimTrack } from './WaveformTrimTrack';
import {
    parseLrc,
    formatLrc,
    readSyncedLyrics,
    writeSyncedLyrics,
    detectLyricsCutConflict,
    shiftLyricLines,
    EditableLyricLine,
} from '../library/lyrics';

interface EditSongDialogProps {
    song: SongMeta;
    onClose: () => void;
}

const formatTimecode = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.00';
    const total = Math.max(0, seconds);
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    const hundredths = Math.floor((total - Math.floor(total)) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
};

const parseTimecode = (text: string): number | null => {
    const match = text.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?$/);
    if (!match) return null;
    const mins = Number(match[1]);
    const secs = Number(match[2]);
    const hundredths = Number(match[3] || '0');
    return mins * 60 + secs + hundredths / 100;
};

const EditSongDialog: React.FC<EditSongDialogProps> = ({ song, onClose }) => {
    const { t } = useTranslation();
    const { updateSong } = useLibrary();

    const [title, setTitle] = useState(song.title);
    const [artist, setArtist] = useState(song.artist || '');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Audio audition player
    const auditionPlayer = useTrimAuditionPlayer(song.id);

    // Total raw audio duration
    const totalDuration = useMemo(() => {
        return auditionPlayer.duration > 0 ? auditionPlayer.duration : (song.duration || 0);
    }, [auditionPlayer.duration, song.duration]);

    // Trim markers
    const [trimStart, setTrimStart] = useState<number>(song.trimStart ?? 0);
    const [trimEnd, setTrimEnd] = useState<number>(song.trimEnd ?? (song.duration || 0));

    // Timecode string inputs
    const [startInputText, setStartInputText] = useState(formatTimecode(song.trimStart ?? 0));
    const [endInputText, setEndInputText] = useState(formatTimecode(song.trimEnd ?? (song.duration || 0)));

    // Synced lyrics data
    const [syncedLines, setSyncedLines] = useState<EditableLyricLine[]>([]);
    const [conflictModalState, setConflictModalState] = useState<{
        conflictCount: number;
        affectedLines: EditableLyricLine[];
        deltaTrim: number;
    } | null>(null);

    // Pause main playback on mount
    useEffect(() => {
        if (audioEngine.isPlaying()) {
            audioEngine.pause();
        }
    }, []);

    // Load synced lyrics for timestamps and shift calculation
    useEffect(() => {
        let active = true;
        const load = async () => {
            if (song.lyrics_status === 'synced') {
                try {
                    const lrc = await readSyncedLyrics(song.id);
                    if (active && lrc?.content) {
                        const parsed = parseLrc(lrc.content);
                        setSyncedLines(parsed);
                    }
                } catch (err) {
                    console.warn('[EditSongDialog] Failed to read synced lyrics for trim conflict check', err);
                }
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [song.id, song.lyrics_status]);

    // Initialize trimEnd when duration becomes known if not already set
    useEffect(() => {
        if (song.trimEnd === undefined && totalDuration > 0 && trimEnd === 0) {
            setTrimEnd(totalDuration);
            setEndInputText(formatTimecode(totalDuration));
        }
    }, [totalDuration, song.trimEnd, trimEnd]);

    // Sync input text when handles move
    const handleTrimStartChange = useCallback((val: number) => {
        const clamped = Math.max(0, Math.min(val, trimEnd - 0.5));
        setTrimStart(clamped);
        setStartInputText(formatTimecode(clamped));
    }, [trimEnd]);

    const handleTrimEndChange = useCallback((val: number) => {
        const clamped = Math.max(trimStart + 0.5, Math.min(val, totalDuration || val));
        setTrimEnd(clamped);
        setEndInputText(formatTimecode(clamped));
    }, [trimStart, totalDuration]);

    // Commit timecode input on blur or Enter
    const commitStartInput = () => {
        const parsed = parseTimecode(startInputText);
        if (parsed !== null) {
            handleTrimStartChange(parsed);
        } else {
            setStartInputText(formatTimecode(trimStart));
        }
    };

    const commitEndInput = () => {
        const parsed = parseTimecode(endInputText);
        if (parsed !== null) {
            handleTrimEndChange(parsed);
        } else {
            setEndInputText(formatTimecode(trimEnd));
        }
    };

    // Nudge helpers
    const nudgeStart = (delta: number) => {
        handleTrimStartChange(Math.round((trimStart + delta) * 100) / 100);
    };

    const nudgeEnd = (delta: number) => {
        handleTrimEndChange(Math.round((trimEnd + delta) * 100) / 100);
    };

    // Grab playhead time
    const grabStartFromPlayhead = () => {
        handleTrimStartChange(auditionPlayer.currentTime);
    };

    const grabEndFromPlayhead = () => {
        handleTrimEndChange(auditionPlayer.currentTime);
    };

    // Reset trim
    const handleResetTrim = () => {
        handleTrimStartChange(0);
        handleTrimEndChange(totalDuration);
    };

    // Lyric timestamps for waveform pips
    const lyricTimestamps = useMemo(() => {
        return syncedLines
            .map((l) => l.timeSeconds)
            .filter((t): t is number => t !== null && Number.isFinite(t));
    }, [syncedLines]);

    // Proceed with save logic
    const performSave = async (resolution: 'drop' | 'clamp' = 'drop') => {
        if (!title.trim()) {
            setError(t('songManagement.editDialog.titleRequired', { defaultValue: 'Song title cannot be empty' }));
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const oldTrimStart = song.trimStart ?? 0;
            const deltaTrim = Math.round((trimStart - oldTrimStart) * 100) / 100;

            // Handle lyrics shift if trimStart changed
            if (Math.abs(deltaTrim) > 0.01 && song.lyrics_status === 'synced' && syncedLines.length > 0) {
                const { lines: shiftedLines } = shiftLyricLines(syncedLines, deltaTrim, resolution);
                const lrcContent = formatLrc(shiftedLines, { title: title.trim(), artist: artist.trim() });
                await writeSyncedLyrics(song.id, lrcContent);
            }

            // Determine final trimStart and trimEnd
            const isFullTrack = trimStart <= 0.01 && (totalDuration <= 0 || trimEnd >= totalDuration - 0.05);
            const finalTrimStart = isFullTrack ? undefined : trimStart;
            const finalTrimEnd = isFullTrack ? undefined : trimEnd;

            await updateSong(song.id, {
                title: title.trim(),
                artist: artist.trim() || undefined,
                trimStart: finalTrimStart,
                trimEnd: finalTrimEnd,
            });

            // If the song being edited is the active song in audioEngine, update its bounds live
            const currentBounds = audioEngine.getTrimBounds();
            if (currentBounds || finalTrimStart !== undefined) {
                if (finalTrimStart !== undefined && finalTrimEnd !== undefined) {
                    audioEngine.setTrimBounds({ start: finalTrimStart, end: finalTrimEnd });
                } else {
                    audioEngine.setTrimBounds(null);
                }
            }

            auditionPlayer.stop();
            onClose();
        } catch (err) {
            console.error('[EditSongDialog] Failed to save song and trim', err);
            setError(t('songManagement.editDialog.saveFailed', { defaultValue: 'Failed to save. Please try again later.' }));
        } finally {
            setIsSaving(false);
            setConflictModalState(null);
        }
    };

    // Pre-save check for lyrics conflict
    const handleSaveClick = async () => {
        const oldTrimStart = song.trimStart ?? 0;
        const deltaTrim = Math.round((trimStart - oldTrimStart) * 100) / 100;

        if (deltaTrim > 0.01 && song.lyrics_status === 'synced' && syncedLines.length > 0) {
            const { conflictCount, affectedLines } = detectLyricsCutConflict(syncedLines, deltaTrim);
            if (conflictCount > 0) {
                // Prompt user to decide between dropping or clamping
                setConflictModalState({ conflictCount, affectedLines, deltaTrim });
                return;
            }
        }

        await performSave('drop');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(3px)',
        }}>
            <div style={{
                backgroundColor: '#232323',
                padding: '24px',
                borderRadius: '12px',
                width: '640px',
                maxWidth: '92vw',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                color: '#fff',
                border: '1px solid #333',
                position: 'relative',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        {t('songManagement.editDialog.title', { defaultValue: 'Edit Song Details' })}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(255, 82, 82, 0.1)',
                        color: '#ff5252',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '13px',
                        border: '1px solid rgba(255, 82, 82, 0.2)',
                    }}>
                        {error}
                    </div>
                )}

                {/* Section 1: Title & Artist Metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#aaa' }}>
                            {t('songManagement.editDialog.titleLabel', { defaultValue: 'Song Title' })} <span style={{ color: '#ff5252' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#161616',
                                border: '1px solid #383838',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '13px',
                                boxSizing: 'border-box',
                            }}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#aaa' }}>
                            {t('songManagement.editDialog.artistLabel', { defaultValue: 'Artist' })}
                        </label>
                        <input
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#161616',
                                border: '1px solid #383838',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '13px',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Section 2: Audio Trimming */}
                <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #2d2d2d',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '24px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>✂️ Audio Trim</span>
                            <span style={{ fontSize: '11px', color: '#777' }}>(Non-destructive, Headphone preview)</span>
                        </div>
                        <button
                            onClick={handleResetTrim}
                            style={{
                                background: 'transparent',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                color: '#aaa',
                                fontSize: '11px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                            }}
                        >
                            ↺ Reset to Full
                        </button>
                    </div>

                    {/* Waveform Track */}
                    <div style={{ marginBottom: '14px' }}>
                        <WaveformTrimTrack
                            audioUrl={auditionPlayer.audioUrl}
                            duration={totalDuration}
                            trimStart={trimStart}
                            trimEnd={trimEnd}
                            currentTime={auditionPlayer.currentTime}
                            onTrimStartChange={handleTrimStartChange}
                            onTrimEndChange={handleTrimEndChange}
                            onSeek={auditionPlayer.seek}
                            lyricTimestamps={lyricTimestamps}
                            height={72}
                        />
                    </div>

                    {/* Precision Time Controls & Nudge Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        {/* Trim Start Box */}
                        <div style={{ background: '#222', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
                            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Intro Start (In-point)</span>
                                <button
                                    onClick={grabStartFromPlayhead}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                                    title="Set Start to current playhead"
                                >
                                    Grab Current
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                    type="text"
                                    value={startInputText}
                                    onChange={(e) => setStartInputText(e.target.value)}
                                    onBlur={commitStartInput}
                                    onKeyDown={(e) => e.key === 'Enter' && commitStartInput()}
                                    style={{
                                        width: '80px',
                                        padding: '4px 6px',
                                        backgroundColor: '#141414',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                    }}
                                />
                                <button onClick={() => nudgeStart(-0.1)} style={nudgeBtnStyle}>-0.1s</button>
                                <button onClick={() => nudgeStart(0.1)} style={nudgeBtnStyle}>+0.1s</button>
                                <button onClick={() => nudgeStart(-1.0)} style={nudgeBtnStyle}>-1s</button>
                                <button onClick={() => nudgeStart(1.0)} style={nudgeBtnStyle}>+1s</button>
                            </div>
                        </div>

                        {/* Trim End Box */}
                        <div style={{ background: '#222', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
                            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Outro End (Out-point)</span>
                                <button
                                    onClick={grabEndFromPlayhead}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                                    title="Set End to current playhead"
                                >
                                    Grab Current
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                    type="text"
                                    value={endInputText}
                                    onChange={(e) => setEndInputText(e.target.value)}
                                    onBlur={commitEndInput}
                                    onKeyDown={(e) => e.key === 'Enter' && commitEndInput()}
                                    style={{
                                        width: '80px',
                                        padding: '4px 6px',
                                        backgroundColor: '#141414',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                    }}
                                />
                                <button onClick={() => nudgeEnd(-0.1)} style={nudgeBtnStyle}>-0.1s</button>
                                <button onClick={() => nudgeEnd(0.1)} style={nudgeBtnStyle}>+0.1s</button>
                                <button onClick={() => nudgeEnd(-1.0)} style={nudgeBtnStyle}>-1s</button>
                                <button onClick={() => nudgeEnd(1.0)} style={nudgeBtnStyle}>+1s</button>
                            </div>
                        </div>
                    </div>

                    {/* Audition Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => auditionPlayer.playSnippet(trimStart, 3, 'in')}
                                disabled={auditionPlayer.isPlaying && auditionPlayer.activeSnippet === 'in'}
                                style={auditionBtnStyle(auditionPlayer.isPlaying && auditionPlayer.activeSnippet === 'in')}
                            >
                                ▶ Audition Start 3s
                            </button>
                            <button
                                onClick={() => auditionPlayer.playSnippet(Math.max(0, trimEnd - 3), 3, 'out')}
                                disabled={auditionPlayer.isPlaying && auditionPlayer.activeSnippet === 'out'}
                                style={auditionBtnStyle(auditionPlayer.isPlaying && auditionPlayer.activeSnippet === 'out')}
                            >
                                ▶ Audition End 3s
                            </button>
                            {auditionPlayer.isPlaying && (
                                <button
                                    onClick={auditionPlayer.stop}
                                    style={{
                                        padding: '5px 12px',
                                        background: '#3a2222',
                                        border: '1px solid #5a3333',
                                        color: '#ff8b8b',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ⏹ Stop
                                </button>
                            )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#777' }}>
                            Effective duration: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{formatTimecode(Math.max(0, trimEnd - trimStart))}</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        style={{
                            padding: '8px 18px',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                        }}
                    >
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                    </button>
                    <button
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        style={{
                            padding: '8px 22px',
                            backgroundColor: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            opacity: isSaving ? 0.7 : 1,
                        }}
                    >
                        {isSaving ? t('songManagement.editDialog.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' })}
                    </button>
                </div>

                {/* Lyrics Cut Conflict Resolution Modal */}
                {conflictModalState && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '24px',
                        zIndex: 10,
                    }}>
                        <div style={{
                            backgroundColor: '#2b2b2b',
                            border: '1px solid #444',
                            borderRadius: '10px',
                            padding: '20px',
                            maxWidth: '440px',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px', color: '#ffb74d' }}>
                                ⚠️ Lyrics Conflict Detected
                            </div>
                            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.5, marginBottom: '16px' }}>
                                <strong>{conflictModalState.conflictCount}</strong> synced lyric line(s) fall inside the trimmed intro section.
                                How would you like to handle their timestamps?
                                <br />
                                <span style={{ fontSize: '11px', color: '#888' }}>(Raw lyrics text is preserved in all cases)</span>
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                <button
                                    onClick={() => performSave('drop')}
                                    disabled={isSaving}
                                    style={{
                                        padding: '10px',
                                        backgroundColor: '#3b2525',
                                        border: '1px solid #6b3b3b',
                                        borderRadius: '6px',
                                        color: '#ff8b8b',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                    }}
                                >
                                    Drop from Synced Timeline (Recommended)
                                </button>
                                <button
                                    onClick={() => performSave('clamp')}
                                    disabled={isSaving}
                                    style={{
                                        padding: '10px',
                                        backgroundColor: '#253525',
                                        border: '1px solid #3b553b',
                                        borderRadius: '6px',
                                        color: '#8be28b',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                    }}
                                >
                                    Group at 00:00.00
                                </button>
                            </div>
                            <button
                                onClick={() => setConflictModalState(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#888',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                Back to Editor
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const nudgeBtnStyle: React.CSSProperties = {
    padding: '4px 6px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '11px',
    cursor: 'pointer',
};

const auditionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    background: active ? 'var(--primary-color)' : '#282828',
    border: '1px solid #3d3d3d',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
});

export default EditSongDialog;
