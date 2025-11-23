import React from 'react';
import { LyricStyleConfig, DEFAULT_LYRIC_STYLES } from '../contexts/UserDataContext';

interface LyricStylePopupProps {
    styles: LyricStyleConfig;
    onChange: (styles: LyricStyleConfig) => void;
    onClose: () => void;
}

const LyricStylePopup: React.FC<LyricStylePopupProps> = ({ styles, onChange, onClose }) => {
    const handleChange = (key: keyof LyricStyleConfig, value: any) => {
        onChange({ ...styles, [key]: value });
    };

    const handleReset = () => {
        onChange(DEFAULT_LYRIC_STYLES);
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '60px',
                right: '16px',
                width: '300px',
                backgroundColor: '#222',
                borderRadius: '12px',
                border: '1px solid #333',
                padding: '16px',
                zIndex: 100,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                color: '#eee',
                fontSize: '14px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>歌詞樣式設定</h3>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}
                >
                    ✕
                </button>
            </div>

            {/* Font Size */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label>字體大小</label>
                    <span style={{ color: '#aaa' }}>{styles.fontSize}px</span>
                </div>
                <input
                    type="range"
                    min="20"
                    max="60"
                    value={styles.fontSize}
                    onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
            </div>

            {/* Colors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>一般文字</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="color"
                            value={styles.inactiveColor}
                            onChange={(e) => handleChange('inactiveColor', e.target.value)}
                            style={{ width: '32px', height: '32px', border: 'none', padding: 0, borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#666' }}>{styles.inactiveColor}</span>
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>高亮文字</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="color"
                            value={styles.activeColor}
                            onChange={(e) => handleChange('activeColor', e.target.value)}
                            style={{ width: '32px', height: '32px', border: 'none', padding: 0, borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#666' }}>{styles.activeColor}</span>
                    </div>
                </div>
            </div>

            {/* Glow & Stroke */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>發光顏色</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="color"
                            value={styles.activeGlowColor.startsWith('#') ? styles.activeGlowColor : '#ff4444'} // Simple fallback for rgba
                            onChange={(e) => handleChange('activeGlowColor', e.target.value)}
                            style={{ width: '32px', height: '32px', border: 'none', padding: 0, borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#aaa' }}>描邊顏色</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="color"
                            value={styles.strokeColor}
                            onChange={(e) => handleChange('strokeColor', e.target.value)}
                            style={{ width: '32px', height: '32px', border: 'none', padding: 0, borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>
                </div>
            </div>

            {/* Stroke Width */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label>描邊寬度</label>
                    <span style={{ color: '#aaa' }}>{styles.strokeWidth}px</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={styles.strokeWidth}
                    onChange={(e) => handleChange('strokeWidth', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
            </div>

            <button
                onClick={handleReset}
                style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#333',
                    color: '#ccc',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#444'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#333'}
            >
                重置為預設值
            </button>
        </div>
    );
};

export default LyricStylePopup;
