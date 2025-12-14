
import React, { useEffect, useState } from 'react';
import { useUpdater } from '../contexts/UpdaterContext';

interface UpdatePopupProps {
    onClose: () => void;
}

const UpdatePopup: React.FC<UpdatePopupProps> = ({ onClose }) => {
    const { status, updateInfo, progress, downloadUpdate, quitAndInstall, ignoreVersion } = useUpdater();
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (status === 'idle') {
            onClose();
        }
    }, [status, onClose]);

    if (!updateInfo) return null;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const handleDownload = () => {
        downloadUpdate();
    };

    const handleIgnore = () => {
        ignoreVersion(updateInfo.version);
        handleClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            opacity: isClosing ? 0 : 1,
            transition: 'opacity 0.2s',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
        }}>
            <div style={{
                backgroundColor: '#252525',
                borderRadius: '12px',
                width: '450px',
                maxWidth: '90%',
                maxHeight: '90vh',
                border: '1px solid #444',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#2a2a2a'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                            {status === 'downloaded' ? '更新已準備就緒' : '有新版本可用'}
                        </h2>
                        <div style={{ fontSize: '13px', color: 'var(--accent-color)', marginTop: '4px' }}>
                            v{updateInfo.version}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontSize: '24px',
                            padding: '0',
                            lineHeight: 1
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    color: '#ddd',
                    fontSize: '14px',
                    lineHeight: '1.6'
                }}>
                    {/* Release Notes */}
                    <div style={{
                        backgroundColor: '#1f1f1f',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {/* Sanitize: Just rendering text content if it's a string, or simple default msg */}
                        {typeof updateInfo.releaseNotes === 'string'
                            ? updateInfo.releaseNotes
                            : (Array.isArray(updateInfo.releaseNotes)
                                ? updateInfo.releaseNotes.map(n => n.note).join('\n')
                                : '此版本沒有提供更新說明。')
                        }
                    </div>

                    {/* Progress */}
                    {status === 'downloading' && progress && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#aaa' }}>
                                <span>下載中...</span>
                                <span>{Math.round(progress.percent)}%</span>
                            </div>
                            <div style={{
                                height: '6px',
                                backgroundColor: '#333',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress.percent}%`,
                                    backgroundColor: 'var(--accent-color)',
                                    transition: 'width 0.2s'
                                }} />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                {(progress.transferred / 1024 / 1024).toFixed(1)}MB / {(progress.total / 1024 / 1024).toFixed(1)}MB
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid #333',
                    backgroundColor: '#2a2a2a',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    {status === 'downloaded' ? (
                        <>
                            <button
                                onClick={handleClose}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    color: '#aaa',
                                    border: '1px solid transparent',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                稍後
                            </button>
                            <button
                                onClick={quitAndInstall}
                                style={{
                                    padding: '8px 20px',
                                    backgroundColor: 'var(--accent-color)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                重新啟動並更新
                            </button>
                        </>
                    ) : status === 'downloading' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <div style={{ color: '#aaa', fontSize: '14px', flex: 1, display: 'flex', alignItems: 'center' }}>
                                請稍候...
                            </div>
                            <button
                                onClick={handleClose}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    color: '#aaa',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                隱藏
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleIgnore}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    color: '#888',
                                    border: '1px solid transparent',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    marginRight: 'auto'
                                }}
                            >
                                忽略此版本
                            </button>
                            <button
                                onClick={handleClose}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    color: '#aaa',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDownload}
                                style={{
                                    padding: '8px 20px',
                                    backgroundColor: 'var(--accent-color)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                下載更新
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdatePopup;
