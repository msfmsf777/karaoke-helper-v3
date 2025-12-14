
import React, { useState } from 'react';
import { useUpdater } from '../contexts/UpdaterContext';

interface DebugUpdaterUIProps {
    inline?: boolean;
}

const DebugUpdaterUI: React.FC<DebugUpdaterUIProps> = ({ inline }) => {
    // Only render in DEV
    if (import.meta.env.PROD) return null;

    const { _debugSetState } = useUpdater();
    const [mockVersion, setMockVersion] = useState('3.1.0');
    const [isOpen, setIsOpen] = useState(false);

    if (!_debugSetState) return null;

    if (!isOpen) {
        return (
            <div
                onClick={() => setIsOpen(true)}
                style={inline ? {
                    backgroundColor: 'rgba(200, 50, 50, 0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-block',
                    verticalAlign: 'middle'
                } : {
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(200, 50, 50, 0.8)',
                    color: 'white',
                    padding: '8px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    // @ts-ignore
                    WebkitAppRegion: 'no-drag'
                }}
            >
                UPDATE DEBUG
            </div>
        );
    }

    const setAvailable = () => {
        _debugSetState({
            status: 'available',
            updateInfo: {
                version: mockVersion,
                files: [],
                path: 'mock-path',
                sha512: 'mock-sha',
                releaseDate: new Date().toISOString(),
                releaseNotes: '### Mock Update\nThis is a simulated update for testing UI.',
            },
            progress: null,
            error: null
        });
    };

    const setProgress = (val: number) => {
        _debugSetState({
            status: 'downloading',
            progress: {
                total: 100 * 1024 * 1024,
                delta: 10 * 1024 * 1024,
                transferred: val * 1024 * 1024,
                percent: val,
                bytesPerSecond: 1024 * 1024
            }
        });
    };

    const setDownloaded = () => {
        _debugSetState({
            status: 'downloaded',
            progress: null
        });
    };

    const setError = () => {
        _debugSetState({
            status: 'error',
            error: 'Simulated update error occurred.'
        });
    };

    const reset = () => {
        _debugSetState({
            status: 'idle',
            updateInfo: null,
            progress: null,
            error: null
        });
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            backgroundColor: '#111',
            border: '1px solid #444',
            padding: '12px',
            borderRadius: '8px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '200px',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff5555', fontWeight: 'bold', fontSize: '12px' }}>
                <span>Updater Debug</span>
                <span onClick={() => setIsOpen(false)} style={{ cursor: 'pointer' }}>×</span>
            </div>

            <input
                value={mockVersion}
                onChange={e => setMockVersion(e.target.value)}
                style={{ background: '#333', border: 'none', color: '#fff', padding: '4px' }}
            />

            <button onClick={setAvailable}>Simulate Available</button>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setProgress(25)}>25%</button>
                <button onClick={() => setProgress(75)}>75%</button>
            </div>
            <button onClick={setDownloaded}>Simulate Ready</button>
            <button onClick={setError}>Simulate Error</button>
            <button onClick={reset}>Reset (Idle)</button>
        </div>
    );
};

export default DebugUpdaterUI;
