import React from 'react';

const LibraryView: React.FC = () => {
    return (
        <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>歌曲庫</h1>

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
                    <div>標題</div>
                    <div>歌手</div>
                    <div>專輯</div>
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
                        <div>測試歌曲 {i}</div>
                        <div style={{ color: '#b3b3b3' }}>未知歌手</div>
                        <div style={{ color: '#b3b3b3' }}>測試專輯</div>
                        <div style={{ color: '#b3b3b3' }}>3:45</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LibraryView;
