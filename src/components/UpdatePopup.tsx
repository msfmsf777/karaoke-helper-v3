
import React, { useEffect, useState } from 'react';
import { useUpdater } from '../contexts/UpdaterContext';

interface UpdatePopupProps {
    onClose: () => void;
}

const UpdatePopup: React.FC<UpdatePopupProps> = ({ onClose }) => {
    const { status, updateInfo, openReleasePage, ignoreVersion } = useUpdater();
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

    const handleGoToDownload = () => {
        openReleasePage();
        handleClose();
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
                            有新版本可用
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
                        whiteSpace: 'normal', // Allow wrapping
                        color: '#ccc'
                    }}>
                        {typeof updateInfo.releaseNotes === 'string' ? (
                            <div
                                dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                                style={{ lineHeight: '1.6' }}
                                className="markdown-body" // Optional class for styling if you add global styles
                            />
                        ) : (
                            <div>
                                {Array.isArray(updateInfo.releaseNotes)
                                    ? updateInfo.releaseNotes.map((n, i) => <div key={i}>{n.note}</div>)
                                    : '此版本沒有提供更新說明。'}
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {status === 'error' && (
                        <div style={{
                            marginTop: '20px',
                            padding: '12px',
                            backgroundColor: 'rgba(255, 0, 0, 0.1)',
                            border: '1px solid #ff4444',
                            borderRadius: '8px',
                            color: '#ff4444',
                            fontSize: '13px'
                        }}>
                            更新失敗。請檢查網路連線或稍後再試。
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
                        onClick={handleGoToDownload}
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
                        前往下載頁面
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdatePopup;
