import React, { useState } from 'react';
import audioEngine from '../audio/AudioEngine';

const DebugPlaybackPanel: React.FC = () => {
    const [speed, setSpeed] = useState('1.0');
    const [pitch, setPitch] = useState('0');
    const [isOpen, setIsOpen] = useState(false);

    const applySpeed = () => {
        const val = parseFloat(speed);
        if (!isNaN(val)) {
            const clamped = Math.max(0.5, Math.min(val, 2.0));
            setSpeed(clamped.toString());
            const current = audioEngine.getPlaybackTransform();
            audioEngine.setPlaybackTransform({ ...current, speed: clamped });
        }
    };

    const applyPitch = () => {
        const val = parseInt(pitch, 10);
        if (!isNaN(val)) {
            const clamped = Math.max(-12, Math.min(val, 12));
            setPitch(clamped.toString());
            const current = audioEngine.getPlaybackTransform();
            audioEngine.setPlaybackTransform({ ...current, transpose: clamped });
        }
    };

    if (!isOpen) {
        return (
            <div style={{ position: 'fixed', bottom: 100, right: 20, zIndex: 9999 }}>
                <button
                    onClick={() => setIsOpen(true)}
                    style={{ padding: '5px 10px', background: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}
                >
                    Debug Playback
                </button>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: 100, right: 20, zIndex: 9999,
            background: '#222', padding: '15px', border: '1px solid #444', borderRadius: '8px',
            color: '#fff', width: '200px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px' }}>Debug Playback</strong>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}
                >
                    ×
                </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#aaa' }}>變速 (0.5-2.0)</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                        value={speed}
                        onChange={e => setSpeed(e.target.value)}
                        style={{ width: '60px', background: '#333', border: '1px solid #555', color: '#fff', padding: '4px', borderRadius: '4px' }}
                    />
                    <button
                        onClick={applySpeed}
                        style={{ flex: 1, background: '#444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        套用
                    </button>
                </div>
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#aaa' }}>變調 (-12 ~ +12)</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                        value={pitch}
                        onChange={e => setPitch(e.target.value)}
                        style={{ width: '60px', background: '#333', border: '1px solid #555', color: '#fff', padding: '4px', borderRadius: '4px' }}
                    />
                    <button
                        onClick={applyPitch}
                        style={{ flex: 1, background: '#444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        套用
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebugPlaybackPanel;
