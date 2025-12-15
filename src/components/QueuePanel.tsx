import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';

const IconDragHandle = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#666">
        <circle cx="8" cy="4" r="2" />
        <circle cx="16" cy="4" r="2" />
        <circle cx="8" cy="12" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="8" cy="20" r="2" />
        <circle cx="16" cy="20" r="2" />
    </svg>
);

interface QueuePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
    const { queue, currentIndex, playQueueIndex, removeFromQueue, moveQueueItem, clearQueue } = useQueue();
    const { getSongById } = useLibrary();
    const [confirmClear, setConfirmClear] = useState(false);

    const panelRef = React.useRef<HTMLDivElement>(null);

    // Capture-phase click blocker to prevent "ghost clicks" after drag
    const isDraggingRef = React.useRef(false);
    // We use a ref to track if we need to block clicks, because the event listener needs to run immediately in the capture phase.
    const shouldBlockClickRef = React.useRef(false);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (shouldBlockClickRef.current) {
                e.stopPropagation();
                e.preventDefault();
                console.log('[QueuePanel] Ghost click blocked');
            }
        };
        // Capture phase is crucial
        window.addEventListener('click', handler, true);
        return () => window.removeEventListener('click', handler, true);
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

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



    const handleDragEnd = (result: DropResult) => {
        isDraggingRef.current = false;

        // Keep blocking for a short window after drag ends to catch the "mouseup -> click" event
        setTimeout(() => {
            shouldBlockClickRef.current = false;
        }, 100);

        if (!result.destination) return;
        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;
        if (sourceIndex === destinationIndex) return;

        moveQueueItem(sourceIndex, destinationIndex);
    };

    return (
        <div
            ref={panelRef}
            className="queue-panel"
            onDragStart={(e) => e.stopPropagation()}

            onDragOver={(e) => e.stopPropagation()}
            onDrop={(e) => e.stopPropagation()}
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
                zIndex: 200, // Higher than TopBar (100)
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
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="queue-panel-list">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                                >
                                    {queue.map((songId, index) => {
                                        const song = getSongById(songId);
                                        const isCurrent = index === currentIndex;
                                        // Use unique key for DND
                                        const draggableId = `q-panel-${songId}-${index}`;

                                        if (!song) return null;

                                        return (
                                            <Draggable key={draggableId} draggableId={draggableId} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onDoubleClick={() => playQueueIndex(index)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '8px 12px',
                                                            backgroundColor: isCurrent
                                                                ? '#2a2a2a'
                                                                : snapshot.isDragging ? '#2a2a2a' : 'transparent',
                                                            borderRadius: '6px',
                                                            borderLeft: isCurrent ? '3px solid var(--accent-color)' : '3px solid transparent',
                                                            gap: '8px',
                                                            position: 'relative',
                                                            ...provided.draggableProps.style
                                                        }}
                                                        className="queue-item"
                                                        onMouseEnter={(e) => {
                                                            if (!isCurrent) e.currentTarget.style.backgroundColor = '#1a1a1a';
                                                            const handle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
                                                            if (handle) handle.style.opacity = '1';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isCurrent && !snapshot.isDragging) e.currentTarget.style.backgroundColor = 'transparent';
                                                            const handle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
                                                            if (handle) handle.style.opacity = '0';
                                                        }}
                                                    >
                                                        {/* Drag Handle */}
                                                        <div className="drag-handle" style={{
                                                            opacity: 0,
                                                            cursor: 'grab',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'opacity 0.2s'
                                                        }}>
                                                            <IconDragHandle />
                                                        </div>

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
                                                                onClick={(e) => { e.stopPropagation(); removeFromQueue(index); }}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#666',
                                                                    cursor: 'pointer',
                                                                    fontSize: '16px',
                                                                    padding: '0 4px',
                                                                }}
                                                                title="從隊列移除"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
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
