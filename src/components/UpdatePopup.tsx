import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdater } from '../contexts/UpdaterContext';
import {
    ResolvedReleaseNotes,
    isReleaseNotesCatalog,
    resolveReleaseNotes,
} from '../../shared/releaseNotes';

interface UpdatePopupProps {
    onClose: () => void;
    releaseNotesOnly?: {
        version: string;
        fallbackNotes?: string | Array<{ note?: string }>;
    };
}

const UpdatePopup: React.FC<UpdatePopupProps> = ({ onClose, releaseNotesOnly }) => {
    const { t, i18n } = useTranslation();
    const {
        status,
        updateInfo,
        errorCode,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        openReleasePage,
        ignoreVersion,
    } = useUpdater();
    const [isClosing, setIsClosing] = useState(false);
    const [localizedNotes, setLocalizedNotes] = useState<ResolvedReleaseNotes | null>(null);

    const isReadOnlyChangelog = Boolean(releaseNotesOnly);
    const displayVersion = releaseNotesOnly?.version ?? updateInfo?.version;
    const rawFallbackNotes = releaseNotesOnly?.fallbackNotes ?? updateInfo?.releaseNotes;

    useEffect(() => {
        if (!isReadOnlyChangelog && status === 'idle') {
            onClose();
        }
    }, [isReadOnlyChangelog, status, onClose]);

    useEffect(() => {
        if (!displayVersion) {
            setLocalizedNotes(null);
            return;
        }

        const controller = new AbortController();
        const url = `https://github.com/msfmsf777/karaoke-helper-v3/releases/download/v${displayVersion}/release-notes.json`;

        fetch(url, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Release notes returned ${response.status}`);
                const payload = await response.json();
                if (!isReleaseNotesCatalog(payload)) return null;
                return resolveReleaseNotes(payload, i18n.language);
            })
            .then((notes) => {
                if (!controller.signal.aborted) {
                    setLocalizedNotes(notes);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setLocalizedNotes(null);
                }
            });

        return () => controller.abort();
    }, [i18n.language, displayVersion]);

    const fallbackReleaseNotes = useMemo(() => (
        normalizeFallbackReleaseNotes(rawFallbackNotes)
    ), [rawFallbackNotes]);

    if (!isReadOnlyChangelog && !updateInfo && status !== 'error') return null;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const handlePrimaryAction = () => {
        if (isReadOnlyChangelog) {
            handleClose();
            return;
        }

        if (status === 'downloaded') {
            installUpdate();
            return;
        }

        if (status === 'error' && !updateInfo) {
            checkForUpdates(true);
            return;
        }

        if (status === 'available' || status === 'error') {
            downloadUpdate();
        }
    };

    const handleIgnore = () => {
        if (!updateInfo) return;
        ignoreVersion(updateInfo.version);
        handleClose();
    };

    const canClose = isReadOnlyChangelog || status !== 'installing';
    const isBusy = !isReadOnlyChangelog && (status === 'downloading' || status === 'installing');
    const primaryDisabled = !isReadOnlyChangelog && (status === 'checking' || status === 'downloading' || status === 'installing');
    const primaryLabel = isReadOnlyChangelog
        ? t('common.close')
        : getPrimaryLabel(status, Boolean(updateInfo), t);

    const errorMessage = errorCode === 'disk_full'
        ? t('updatesPopup.diskFullError')
        : errorCode === 'install_failed'
            ? t('updatesPopup.installFailedError')
            : t('updatesPopup.error');

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
            WebkitAppRegion: 'no-drag'
        } as React.CSSProperties}>
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
                            {isReadOnlyChangelog
                                ? t('updatesPopup.justUpdated', { version: displayVersion })
                                : t('updatesPopup.title')}
                        </h2>
                        {displayVersion && (
                            <div style={{ fontSize: '13px', color: 'var(--accent-color)', marginTop: '4px' }}>
                                v{displayVersion}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={canClose ? handleClose : undefined}
                        disabled={!canClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#aaa',
                            cursor: canClose ? 'pointer' : 'default',
                            fontSize: '24px',
                            padding: '0',
                            lineHeight: 1,
                            opacity: canClose ? 1 : 0.4
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    color: '#ddd',
                    fontSize: '14px',
                    lineHeight: '1.6'
                }}>
                    {displayVersion && (
                        <div style={{
                            backgroundColor: '#1f1f1f',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #333',
                            maxHeight: '240px',
                            overflowY: 'auto',
                            whiteSpace: 'normal',
                            color: '#ccc'
                        }}>
                            {localizedNotes ? (
                                <StructuredReleaseNotes notes={localizedNotes} />
                            ) : fallbackReleaseNotes ? (
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                    {fallbackReleaseNotes}
                                </div>
                            ) : (
                                <div>{t('updatesPopup.noReleaseNotes')}</div>
                            )}
                        </div>
                    )}

                    {!isReadOnlyChangelog && (status === 'downloaded' || status === 'installing') && (
                        <div style={{
                            marginTop: '16px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(29, 185, 84, 0.1)',
                            border: '1px solid rgba(29, 185, 84, 0.3)',
                            color: '#86efac',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <span>✓</span>
                            <span>
                                {status === 'installing'
                                    ? t('updatesPopup.status.installing')
                                    : t('updatesPopup.readyToRestart')}
                            </span>
                        </div>
                    )}

                    {!isReadOnlyChangelog && status === 'error' && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px 14px',
                            backgroundColor: errorCode === 'disk_full'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(255, 68, 68, 0.1)',
                            border: errorCode === 'disk_full'
                                ? '1px solid rgba(245, 158, 11, 0.5)'
                                : '1px solid #ff4444',
                            borderRadius: '8px',
                            color: errorCode === 'disk_full' ? '#fcd34d' : '#ff6b6b',
                            fontSize: '13px',
                            lineHeight: 1.5,
                        }}>
                            {errorMessage}
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid #333',
                    backgroundColor: '#2a2a2a',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    {!isReadOnlyChangelog && (
                        <button
                            onClick={handleIgnore}
                            disabled={!updateInfo || isBusy}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'transparent',
                                color: '#888',
                                border: '1px solid transparent',
                                borderRadius: '6px',
                                cursor: (!updateInfo || isBusy) ? 'default' : 'pointer',
                                fontSize: '14px',
                                marginRight: 'auto',
                                opacity: (!updateInfo || isBusy) ? 0.45 : 1
                            }}
                        >
                            {t('updatesPopup.ignore')}
                        </button>
                    )}
                    {!isReadOnlyChangelog && status === 'error' && updateInfo && (
                        <button
                            onClick={openReleasePage}
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
                            {t('updatesPopup.openDownloadPage')}
                        </button>
                    )}
                    {!isReadOnlyChangelog && (
                        <button
                            onClick={canClose ? handleClose : undefined}
                            disabled={!canClose}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'transparent',
                                color: '#aaa',
                                border: '1px solid #444',
                                borderRadius: '6px',
                                cursor: canClose ? 'pointer' : 'default',
                                fontSize: '14px',
                                opacity: canClose ? 1 : 0.45
                            }}
                        >
                            {t('common.cancel')}
                        </button>
                    )}
                    <button
                        onClick={handlePrimaryAction}
                        disabled={primaryDisabled}
                        style={{
                            padding: '8px 20px',
                            backgroundColor: 'var(--accent-color)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: primaryDisabled ? 'wait' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: primaryDisabled ? 0.7 : 1
                        }}
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const StructuredReleaseNotes: React.FC<{ notes: ResolvedReleaseNotes }> = ({ notes }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{notes.title}</div>
            {notes.summary && <div style={{ marginTop: '4px', color: '#aaa' }}>{notes.summary}</div>}
        </div>
        {notes.sections.map((section, index) => (
            <section key={`${section.title}-${index}`}>
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{section.title}</div>
                {section.body && <div style={{ whiteSpace: 'pre-wrap' }}>{section.body}</div>}
                {section.items && (
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {section.items.map((item, itemIndex) => (
                            <li key={`${item}-${itemIndex}`}>{item}</li>
                        ))}
                    </ul>
                )}
            </section>
        ))}
    </div>
);

function normalizeFallbackReleaseNotes(releaseNotes: unknown): string | null {
    if (typeof releaseNotes === 'string') {
        return stripHtml(releaseNotes).trim() || null;
    }

    if (Array.isArray(releaseNotes)) {
        const lines = releaseNotes
            .map((note) => {
                if (typeof note === 'string') return stripHtml(note);
                if (note && typeof note === 'object' && 'note' in note) {
                    return stripHtml(String((note as { note: unknown }).note ?? ''));
                }
                return '';
            })
            .filter(Boolean);
        return lines.length > 0 ? lines.join('\n') : null;
    }

    return null;
}

function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, '');
}

function getPrimaryLabel(status: string, hasUpdateInfo: boolean, t: (key: string) => string): string {
    if (status === 'downloaded') return t('updatesPopup.updateNow');
    if (status === 'installing') return t('updatesPopup.status.installing');
    if (status === 'error') return hasUpdateInfo ? t('updatesPopup.retry') : t('settings.updates.check');
    return t('updatesPopup.updateNow');
}

export default UpdatePopup;
