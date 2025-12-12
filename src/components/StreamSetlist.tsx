import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import ReplayIcon from '../assets/icons/replay.svg';
// Icons are defined inline for now to avoid import issues until assets are confirmed


// Fallback icons if SVGs not found/imported yet - using simple SVG here for safety
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

const IconDelete = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
    </svg>
);

const StreamSetlist: React.FC = () => {
    const { queue, currentIndex, moveQueueItem, removeFromQueue, addToQueue } = useQueue();
    const { getSongById } = useLibrary();
    const [activeTab, setActiveTab] = useState<'up_next' | 'played'>('up_next');

    // Derived lists
    const playedSongs = queue.slice(0, currentIndex);
    const upNextSongs = queue.slice(currentIndex + 1);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        if (sourceIndex === destinationIndex) return;

        // The Drag context sees indices 0 to N inside "upNextSongs".
        // We need to map these back to global queue indices.
        // Global Index = currentIndex + 1 + localIndex
        const globalSourceIndex = currentIndex + 1 + sourceIndex;
        const globalDestIndex = currentIndex + 1 + destinationIndex;

        moveQueueItem(globalSourceIndex, globalDestIndex);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sticky Header / Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid #333',
                marginBottom: '8px',
                position: 'sticky',
                top: 0,
                backgroundColor: '#111',
                zIndex: 10
            }}>
                <button
                    onClick={() => setActiveTab('up_next')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'up_next' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'up_next' ? '#fff' : '#666',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'up_next' ? 'bold' : 'normal',
                        transition: 'color 0.2s'
                    }}
                >
                    待播清單 ({upNextSongs.length})
                </button>
                <button
                    onClick={() => setActiveTab('played')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'played' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'played' ? '#fff' : '#666',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'played' ? 'bold' : 'normal',
                        transition: 'color 0.2s'
                    }}
                >
                    已播清單 ({playedSongs.length})
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTab === 'played' ? (
                    // Played List (Static, no DND)
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {playedSongs.length === 0 ? (
                            <div style={{ padding: '12px', color: '#444', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                                尚無已播歌曲
                            </div>
                        ) : (
                            playedSongs.map((songId, idx) => {
                                const song = getSongById(songId);
                                if (!song) return null;
                                return (
                                    <div
                                        key={`${songId}-${idx}`}
                                        style={{
                                            padding: '8px 12px',
                                            opacity: 0.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            position: 'relative'
                                        }}
                                        className="stream-list-item"
                                        onMouseEnter={(e) => {
                                            const btn = e.currentTarget.querySelector('.requeue-btn') as HTMLElement;
                                            if (btn) btn.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                            const btn = e.currentTarget.querySelector('.requeue-btn') as HTMLElement;
                                            if (btn) btn.style.opacity = '0';
                                        }}
                                    >
                                        <div style={{ color: '#666', fontSize: '12px', width: '20px', textAlign: 'center' }}>
                                            {idx + 1}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: '#fff', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {song.title}
                                            </div>
                                            <div style={{ color: '#888', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {song.artist || 'Unknown'}
                                            </div>
                                        </div>

                                        <button
                                            className="requeue-btn"
                                            onClick={() => addToQueue(songId)}
                                            style={{
                                                opacity: 0,
                                                background: 'none',
                                                border: 'none',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                transition: 'opacity 0.2s',
                                            }}
                                            title="將此曲重新加入待播清單底部"
                                        >
                                            <img src={ReplayIcon} alt="Requeue" style={{ width: '16px', height: '16px', filter: 'invert(1)' }} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    // Up Next List (Draggable)
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="up-next-list">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                                >
                                    {upNextSongs.length === 0 ? (
                                        <div style={{ padding: '12px', color: '#444', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                                            待播清單即將清空
                                        </div>
                                    ) : (
                                        upNextSongs.map((songId, idx) => {
                                            const song = getSongById(songId);
                                            // The key MUST be unique and stable. Using index in combo or strict ID if unique.
                                            // Since duplicates are discouraged but possible in theory, we use `${songId}-${idx}` mapping to original Q
                                            // But for DND we need consistent IDs.
                                            // 'idx' here is local index in upNextSongs.
                                            const draggableId = `up-next-${songId}-${idx}`;

                                            if (!song) return null;

                                            return (
                                                <Draggable key={draggableId} draggableId={draggableId} index={idx}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            style={{
                                                                padding: '8px 12px',
                                                                backgroundColor: snapshot.isDragging ? '#2a2a2a' : 'transparent',
                                                                borderRadius: '8px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '12px',
                                                                position: 'relative',
                                                                ...provided.draggableProps.style
                                                            }}
                                                            className="stream-list-item"
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#1a1a1a';
                                                                const handle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
                                                                const num = e.currentTarget.querySelector('.item-number') as HTMLElement;
                                                                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                                                                if (handle) handle.style.display = 'flex';
                                                                if (num) num.style.display = 'none';
                                                                if (btn) btn.style.opacity = '1';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!snapshot.isDragging) e.currentTarget.style.backgroundColor = 'transparent';
                                                                const handle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
                                                                const num = e.currentTarget.querySelector('.item-number') as HTMLElement;
                                                                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                                                                if (handle) handle.style.display = 'none';
                                                                if (num) num.style.display = 'block';
                                                                if (btn) btn.style.opacity = '0';
                                                            }}
                                                        >
                                                            {/* Number (Default) */}
                                                            <div className="item-number" style={{
                                                                color: '#666',
                                                                fontSize: '12px',
                                                                width: '16px',
                                                                textAlign: 'center',
                                                                display: 'block'
                                                            }}>
                                                                {idx + 1}
                                                            </div>

                                                            {/* Drag Handle (Hover) */}
                                                            <div className="drag-handle" style={{
                                                                cursor: 'grab',
                                                                display: 'none',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '16px'
                                                            }}>
                                                                <IconDragHandle />
                                                            </div>

                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ color: '#ccc', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {song.title}
                                                                </div>
                                                                <div style={{ color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {song.artist || 'Unknown'}
                                                                </div>
                                                            </div>

                                                            {/* Delete Button (Hidden by default, show on hover via CSS/JS) */}
                                                            <button
                                                                className="delete-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // prevent drag start if native
                                                                    // Global index = currentIndex + 1 + idx
                                                                    removeFromQueue(currentIndex + 1 + idx);
                                                                }}
                                                                style={{
                                                                    opacity: 0,
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#888',
                                                                    cursor: 'pointer',
                                                                    padding: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    transition: 'opacity 0.2s, color 0.2s'
                                                                }}
                                                                title="從清單移除"
                                                                onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
                                                                onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
                                                            >
                                                                <IconDelete />
                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })
                                    )}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                )}
            </div>
        </div>
    );
};

export default StreamSetlist;
