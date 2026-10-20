import React, { useState, useRef, useEffect } from 'react';
import { useUpdater } from '../contexts/UpdaterContext';

interface DebugUpdaterUIProps {
    inline?: boolean;
}

const DebugUpdaterUI: React.FC<DebugUpdaterUIProps> = ({ inline }) => {
    const { _debugSetState, _debugSimulateFlow, openUpdatePopup, closeUpdatePopup } = useUpdater();
    const [mockVersion, setMockVersion] = useState('3.4.2');
    const [isOpen, setIsOpen] = useState(false);

    // Draggable position (placed above footer player by default)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
        x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 300) : 100,
        y: typeof window !== 'undefined' ? Math.max(60, window.innerHeight - 430) : 100,
    }));
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
        startX: 0,
        startY: 0,
        posX: 0,
        posY: 0,
    });

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPosition({
                x: Math.max(10, Math.min(window.innerWidth - 270, dragRef.current.posX + dx)),
                y: Math.max(10, Math.min(window.innerHeight - 160, dragRef.current.posY + dy)),
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            posX: position.x,
            posY: position.y,
        };
    };

    // Strictly excluded in production builds
    if (import.meta.env.PROD) return null;
    if (!_debugSetState) return null;

    if (!isOpen) {
        return (
            <div
                onClick={() => setIsOpen(true)}
                style={inline ? {
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    color: '#fff',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    verticalAlign: 'middle',
                } : {
                    position: 'fixed',
                    bottom: '100px',
                    right: '20px',
                    backgroundColor: 'rgba(16, 185, 129, 0.9)',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    zIndex: 99999,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    // @ts-ignore
                    WebkitAppRegion: 'no-drag',
                }}
            >
                <span>🚀</span>
                <span>UPDATE DEBUG</span>
            </div>
        );
    }

    const buildMockUpdateInfo = () => ({
        version: mockVersion,
        files: [],
        path: 'mock-path',
        sha512: 'mock-sha',
        releaseDate: new Date().toISOString(),
        releaseNotes:
            `### ✨ KHelper v${mockVersion} 更新重點\n` +
            `- 全新 Discord 風格無縫背景預載與一鍵自動重啟更新體驗\n` +
            `- 支援 NVIDIA RTX 50 系列 (Blackwell sm_120) CUDA 12.8 硬體加速分離\n` +
            `- 改善磁碟空間不足預檢機制與安裝保護`,
    });

    const simulateReadyToUpdate = () => {
        _debugSetState({
            status: 'downloaded',
            updateInfo: buildMockUpdateInfo(),
            progress: {
                percent: 100,
                transferred: 100 * 1024 * 1024,
                total: 100 * 1024 * 1024,
                bytesPerSecond: 0,
            },
            error: null,
            errorCode: null,
            lastCheckTime: Date.now(),
            simulatedOutcome: 'success',
        });
    };

    const runDirectSimulatedSuccess = () => {
        simulateReadyToUpdate();
        _debugSimulateFlow?.('success', mockVersion);
    };

    const runSimulatedFailedUpgrade = () => {
        _debugSetState({
            status: 'downloaded',
            updateInfo: buildMockUpdateInfo(),
            progress: {
                percent: 100,
                transferred: 100 * 1024 * 1024,
                total: 100 * 1024 * 1024,
                bytesPerSecond: 0,
            },
            error: null,
            errorCode: null,
            simulatedOutcome: 'fail',
        });
        _debugSimulateFlow?.('fail', mockVersion);
    };

    const simulateDiskFull = () => {
        _debugSetState({
            status: 'error',
            errorCode: 'disk_full',
            updateInfo: buildMockUpdateInfo(),
            progress: null,
            error: 'Insufficient disk space to download update.',
        });
        openUpdatePopup();
    };

    const simulateBackgroundPreDownload = () => {
        closeUpdatePopup();
        _debugSetState({
            status: 'downloading',
            updateInfo: buildMockUpdateInfo(),
            progress: {
                percent: 45,
                transferred: 45 * 1024 * 1024,
                total: 100 * 1024 * 1024,
                bytesPerSecond: 5 * 1024 * 1024,
            },
            error: null,
            errorCode: null,
            lastCheckTime: Date.now(),
        });
    };

    const reset = () => {
        closeUpdatePopup();
        _debugSetState({
            status: 'idle',
            updateInfo: null,
            progress: null,
            error: null,
            errorCode: null,
        });
    };

    const btnStyle: React.CSSProperties = {
        padding: '6px 8px',
        backgroundColor: '#27272a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '5px',
        color: '#e4e4e7',
        fontSize: '11px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    };

    return (
        <div
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: '260px',
                backgroundColor: '#18181b',
                border: '1px solid #10b981',
                borderRadius: '10px',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
                padding: '12px',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                color: '#fff',
                fontSize: '12px',
                userSelect: isDragging ? 'none' : 'auto',
                // @ts-ignore
                WebkitAppRegion: 'no-drag',
            }}
        >
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #27272a',
                    paddingBottom: '6px',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
                title="按住此處可拖曳移動浮動面板"
            >
                <strong style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🚀</span> Updater Debug <span style={{ fontSize: '10px', color: '#6ee7b7', fontWeight: 'normal' }}>⠿ 拖曳</span>
                </strong>
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                    }}
                    style={{ cursor: 'pointer', color: '#a1a1aa', fontSize: '14px', padding: '0 4px' }}
                >
                    ✕
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#a1a1aa' }}>
                <span>模擬版本:</span>
                <input
                    value={mockVersion}
                    onChange={e => setMockVersion(e.target.value)}
                    style={{
                        flex: 1,
                        background: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '4px',
                        color: '#fff',
                        padding: '3px 6px',
                        fontSize: '11px',
                    }}
                />
            </div>

            <button style={{ ...btnStyle, borderColor: 'rgba(16, 185, 129, 0.45)', backgroundColor: 'rgba(6, 95, 70, 0.35)' }} onClick={simulateReadyToUpdate}>
                🟢 1. 模擬預載完成 (點頂欄綠鈕體驗完整流程)
            </button>

            <button style={btnStyle} onClick={runDirectSimulatedSuccess}>
                ▶️ 直接執行模擬成功更新 (Splash → 重啟)
            </button>

            <button style={{ ...btnStyle, borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={runSimulatedFailedUpgrade}>
                💥 2. 模擬升級失敗回退 (Splash → 失敗提示)
            </button>

            <button style={{ ...btnStyle, borderColor: 'rgba(245, 158, 11, 0.4)' }} onClick={simulateDiskFull}>
                ⚠️ 3. 模擬磁碟空間不足 (Disk Full)
            </button>

            <button style={btnStyle} onClick={simulateBackgroundPreDownload}>
                ⏳ 4. 模擬背景靜默預載中 (顯示最新)
            </button>

            <div style={{ borderTop: '1px solid #27272a', paddingTop: '6px', marginTop: '2px' }}>
                <button
                    style={{ ...btnStyle, width: '100%', backgroundColor: '#3f3f46', textAlign: 'center', fontWeight: 600 }}
                    onClick={reset}
                >
                    🔄 還原預設狀態 (Reset)
                </button>
            </div>
        </div>
    );
};

export default DebugUpdaterUI;
