import React, { useState } from 'react';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';

interface QueuePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
    const { queue, currentIndex, playQueueIndex, removeFromQueue, moveQueueItem, clearQueue } = useQueue();
    const { getSongById } = useLibrary();
    const [confirmClear, setConfirmClear] = useState(false);

    if (!isOpen) return null;

    const handleClear = () => {
        if (confirmClear) {
            clearQueue();
            setConfirmClear(false);
        } else {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: '90px', // Above player bar
                width: '350px',
                backgroundColor: '#181818',
                borderLeft: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                boxShadow: '-5px 0 20px rgba(0,0,0,0.5)',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#202020',
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>播放隊列</h2>
                    <div style={{ fontSize: '12px', color: '#888' }}>共 {queue.length} 首歌曲</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleClear}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: confirmClear ? '#ff4444' : '#888',
                            cursor: 'pointer',
                            fontSize: '13px',
                            padding: '4px 8px',
                        }}
                    >
                        {confirmClear ? '確定清空?' : '清空'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: '0 4px',
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {queue.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                        播放隊列是空的，請在歌曲庫或歌單中加入歌曲。
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {queue.map((songId, index) => {
                            const song = getSongById(songId);
                            const isCurrent = index === currentIndex;

                            if (!song) return null;

                            return (
                                <div
                                    key={`${songId}-${index}`}
                                    onDoubleClick={() => playQueueIndex(index)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        backgroundColor: isCurrent ? '#2a2a2a' : 'transparent',
                                        borderRadius: '6px',
                                        borderLeft: isCurrent ? '3px solid var(--accent-color)' : '3px solid transparent',
                                    }}
                                    className="queue-item"
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            color: isCurrent ? 'var(--accent-color)' : '#ddd',
                                            fontWeight: isCurrent ? 'bold' : 'normal',
                                            fontSize: '14px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {song.title}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '12px' }}>
                                            {song.artist || 'Unknown'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); moveQueueItem(index, index - 1); }}
                                            disabled={index === 0}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: index === 0 ? '#333' : '#666',
                                                cursor: index === 0 ? 'default' : 'pointer',
                                                fontSize: '12px',
                                                padding: '2px',
                                            }}
                                            title="上移"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); moveQueueItem(index, index + 1); }}
                                            disabled={index === queue.length - 1}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: index === queue.length - 1 ? '#333' : '#666',
                                                cursor: index === queue.length - 1 ? 'default' : 'pointer',
                                                fontSize: '12px',
                                                padding: '2px',
                                            }}
                                            title="下移"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromQueue(index); }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#666',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                padding: '0 4px',
                                                marginLeft: '4px',
                                            }}
                                            title="從隊列移除"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Hint */}
            <div style={{
                padding: '8px 16px',
                borderTop: '1px solid #333',
                fontSize: '11px',
                color: '#555',
                textAlign: 'center',
                backgroundColor: '#1a1a1a'
            }}>
                雙擊可立即播放此曲
            </div>
        </div>
    );
};

export default QueuePanel;
