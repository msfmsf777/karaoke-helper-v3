import React from 'react';

const StreamModeView: React.FC = () => {
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000',
            padding: '32px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px'
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>🔴 直播模式 (WIP)</h1>
                <div style={{
                    padding: '4px 12px',
                    backgroundColor: '#ff0000',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                }}>
                    LIVE
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, gap: '24px' }}>
                {/* Setlist Column */}
                <div style={{ flex: 1, backgroundColor: '#111', borderRadius: '8px', padding: '16px' }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>Setlist</h2>
                    <div style={{ color: '#555', fontStyle: 'italic' }}>Coming soon...</div>
                </div>

                {/* Lyrics Preview Column */}
                <div style={{ flex: 2, backgroundColor: '#111', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#333' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>📺</div>
                        <div>Lyrics Overlay Preview</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreamModeView;
