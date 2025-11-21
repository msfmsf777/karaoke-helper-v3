import React, { useState, useEffect } from 'react';
import { SongMeta } from '../../shared/songTypes';
import { useLibrary } from '../contexts/LibraryContext';

interface EditSongDialogProps {
    song: SongMeta;
    onClose: () => void;
}

const EditSongDialog: React.FC<EditSongDialogProps> = ({ song, onClose }) => {
    const { updateSong } = useLibrary();
    const [title, setTitle] = useState(song.title);
    const [artist, setArtist] = useState(song.artist || '');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTitle(song.title);
        setArtist(song.artist || '');
    }, [song]);

    const handleSave = async () => {
        if (!title.trim()) {
            setError('歌曲標題不能為空');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await updateSong(song.id, {
                title: title.trim(),
                artist: artist.trim() || undefined,
            });
            onClose();
        } catch (err) {
            console.error('Failed to update song', err);
            setError('儲存失敗，請稍後再試');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
        }}>
            <div style={{
                backgroundColor: '#2d2d2d',
                padding: '24px',
                borderRadius: '8px',
                width: '400px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                color: '#fff',
            }}>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>編輯歌曲資訊</h2>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(255, 82, 82, 0.1)',
                        color: '#ff5252',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        fontSize: '14px',
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
                        歌曲標題 <span style={{ color: '#ff5252' }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                        }}
                        autoFocus
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
                        歌手
                    </label>
                    <input
                        type="text"
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                        }}
                    >
                        {isSaving ? '儲存中...' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditSongDialog;
