import React, { useState } from 'react';

interface LibraryViewProps {
    onSelectFile: (filePath: string) => Promise<void>;
    selectedTrackName?: string;
}

const LibraryView: React.FC<LibraryViewProps> = ({ onSelectFile, selectedTrackName }) => {
    const [isPicking, setIsPicking] = useState(false);

    const handlePickFile = async () => {
        if (!window.api?.openAudioFileDialog) {
            console.error('[Library] File dialog API is not available');
            return;
        }

        setIsPicking(true);
        try {
            const filePath = await window.api.openAudioFileDialog();
            if (filePath) {
                await onSelectFile(filePath);
            }
        } catch (err) {
            console.error('[Library] Failed to select file', err);
        } finally {
            setIsPicking(false);
        }
    };

    return (
        <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>歌曲庫</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <button
                    onClick={handlePickFile}
                    disabled={isPicking}
                    style={{
                        padding: '10px 18px',
                        backgroundColor: 'var(--accent-color)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '20px',
                        fontWeight: 600,
                        cursor: isPicking ? 'wait' : 'pointer',
                        opacity: isPicking ? 0.7 : 1,
                    }}
                >
                    {isPicking ? '載入中...' : '選擇檔案'}
                </button>
                {selectedTrackName && (
                    <div style={{ color: '#b3b3b3', fontSize: '14px' }}>
                        目前選取: <span style={{ color: '#fff' }}>{selectedTrackName}</span>
                    </div>
                )}
            </div>

            <div style={{
                backgroundColor: '#181818',
                borderRadius: '8px',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 4fr 3fr 2fr 1fr',
                    padding: '12px 16px',
                    borderBottom: '1px solid #282828',
                    color: '#b3b3b3',
                    fontSize: '14px'
                }}>
                    <div>#</div>
                    <div>歌曲名稱</div>
                    <div>專輯 / 來源</div>
                    <div>演出者</div>
                    <div>時長</div>
                </div>

                {/* Dummy Rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 4fr 3fr 2fr 1fr',
                        padding: '12px 16px',
                        borderBottom: '1px solid #282828',
                        color: '#fff',
                        fontSize: '14px',
                        alignItems: 'center'
                    }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#282828'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <div style={{ color: '#b3b3b3' }}>{i}</div>
                        <div>示例歌曲 {i}</div>
                        <div style={{ color: '#b3b3b3' }}>未來曲庫</div>
                        <div style={{ color: '#b3b3b3' }}>示例歌手</div>
                        <div style={{ color: '#b3b3b3' }}>3:45</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LibraryView;
