import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '../contexts/UserDataContext';
import {
    acceleratorFromKeyboardEvent,
    DEFAULT_HOTKEY_CONFIG,
    formatAccelerator,
    HOTKEY_ACTIONS,
    HotkeyAction,
    HotkeyRegistrationStatus,
    isPlainGlobalAccelerator,
    mergeHotkeyConfig,
    normalizeAccelerator,
} from '../../shared/hotkeys';
import RemoveIcon from '../assets/icons/remove.svg';
import {
    getHotkeyActionDescription,
    getHotkeyActionLabel,
    getHotkeyFailureLabel,
    getHotkeyGroupLabel,
} from '../i18n/domainLabels';

type HotkeyScope = 'local' | 'global';

const MEDIA_PRESETS: Partial<Record<HotkeyAction, string>> = {
    playPause: 'MediaPlayPause',
    nextTrack: 'MediaNextTrack',
    previousTrack: 'MediaPreviousTrack',
};

function getDuplicateActions(entries: { action: HotkeyAction; accelerator: string }[]) {
    const seen = new Map<string, HotkeyAction>();
    const duplicates = new Set<HotkeyAction>();

    for (const entry of entries) {
        if (!entry.accelerator) continue;
        const existing = seen.get(entry.accelerator);
        if (existing) {
            duplicates.add(existing);
            duplicates.add(entry.action);
        } else {
            seen.set(entry.accelerator, entry.action);
        }
    }

    return duplicates;
}

const HotkeysSettingsSection: React.FC = () => {
    const { t } = useTranslation();
    const { hotkeys, setHotkeys } = useUserData();
    const [recording, setRecording] = useState<{ action: HotkeyAction; scope: HotkeyScope } | null>(null);
    const [status, setStatus] = useState<HotkeyRegistrationStatus | null>(null);

    const updateBinding = useCallback((action: HotkeyAction, scope: HotkeyScope, accelerator: string) => {
        setHotkeys(mergeHotkeyConfig({
            ...hotkeys,
            bindings: {
                ...hotkeys.bindings,
                [action]: {
                    ...hotkeys.bindings[action],
                    [scope]: normalizeAccelerator(accelerator),
                },
            },
        }));
    }, [hotkeys, setHotkeys]);

    useEffect(() => {
        const statusPromise = window.khelper?.hotkeys?.getStatus?.();
        statusPromise?.then(setStatus).catch(() => undefined);
        return window.khelper?.hotkeys?.onStatus?.(setStatus);
    }, []);

    useEffect(() => {
        if (!recording) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                setRecording(null);
                return;
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
                updateBinding(recording.action, recording.scope, '');
                setRecording(null);
                return;
            }

            const accelerator = acceleratorFromKeyboardEvent(event);
            if (!accelerator) return;

            updateBinding(recording.action, recording.scope, accelerator);
            setRecording(null);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [recording, updateBinding]);

    const localDuplicates = useMemo(() => getDuplicateActions(
        HOTKEY_ACTIONS.map(({ action }) => ({ action, accelerator: normalizeAccelerator(hotkeys.bindings[action].local) }))
    ), [hotkeys]);

    const globalDuplicates = useMemo(() => getDuplicateActions(
        HOTKEY_ACTIONS.map(({ action }) => ({ action, accelerator: normalizeAccelerator(hotkeys.bindings[action].global) }))
    ), [hotkeys]);

    const groupedActions = useMemo(() => ({
        playback: HOTKEY_ACTIONS.filter((item) => item.group === 'playback'),
        custom: HOTKEY_ACTIONS.filter((item) => item.group === 'custom'),
    }), []);

    const resetRecommendedDefaults = () => {
        const nextBindings = { ...hotkeys.bindings };

        HOTKEY_ACTIONS.forEach(({ action }) => {
            const defaults = DEFAULT_HOTKEY_CONFIG.bindings[action];
            nextBindings[action] = {
                local: defaults.local ? defaults.local : hotkeys.bindings[action].local,
                global: defaults.global ? defaults.global : hotkeys.bindings[action].global,
            };
        });

        setHotkeys(mergeHotkeyConfig({
            ...hotkeys,
            bindings: nextBindings,
        }));
    };

    const renderStatus = (action: HotkeyAction) => {
        if (globalDuplicates.has(action)) return <span style={{ color: '#ff7777' }}>{t('settings.hotkeys.status.duplicateGlobal')}</span>;
        const globalAccelerator = hotkeys.bindings[action].global;
        if (globalAccelerator && isPlainGlobalAccelerator(globalAccelerator)) {
            return <span style={{ color: '#ff7777' }}>{t('domain.hotkeys.failures.plainGlobal')}</span>;
        }
        if (localDuplicates.has(action)) return <span style={{ color: '#ffb86c' }}>{t('settings.hotkeys.status.duplicateLocal')}</span>;
        if (!hotkeys.globalHotkeysEnabled && globalAccelerator) return <span style={{ color: '#888' }}>{t('settings.hotkeys.status.globalDisabled')}</span>;
        if (status?.failed[action]) return <span style={{ color: '#ff7777' }}>{getHotkeyFailureLabel(t, status.failed[action])}</span>;
        if (hotkeys.globalHotkeysEnabled && globalAccelerator && status?.registered[action]) {
            return <span style={{ color: '#8be28b' }}>{t('settings.hotkeys.status.applied')}</span>;
        }
        return <span style={{ color: '#777' }}>-</span>;
    };

    const renderShortcutButton = (action: HotkeyAction, scope: HotkeyScope) => {
        const value = hotkeys.bindings[action][scope];
        const isRecording = recording?.action === action && recording.scope === scope;
        const duplicate = scope === 'local' ? localDuplicates.has(action) : globalDuplicates.has(action);
        const invalidGlobal = scope === 'global' && value && isPlainGlobalAccelerator(value);

        return (
            <button
                type="button"
                onClick={() => setRecording({ action, scope })}
                style={{
                    minWidth: '112px',
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: `1px solid ${duplicate || invalidGlobal ? '#aa4444' : isRecording ? 'var(--accent-color)' : '#444'}`,
                    background: isRecording ? 'rgba(255,255,255,0.1)' : '#1f1f1f',
                    color: value ? '#fff' : '#888',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'center',
                }}
                title={isRecording ? t('settings.hotkeys.recordingHint') : t('settings.hotkeys.recordHint')}
            >
                {isRecording ? t('settings.hotkeys.recording') : value ? formatAccelerator(value) : t('domain.hotkeys.unset')}
            </button>
        );
    };

    const renderActionRow = (action: HotkeyAction, label: string, description: string) => (
        <div
            key={action}
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(150px, 1fr) 128px 190px 128px 40px',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{label}</div>
                <div style={{ color: '#999', fontSize: '12px', marginTop: '2px' }}>{description}</div>
            </div>
            {renderShortcutButton(action, 'local')}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {renderShortcutButton(action, 'global')}
                {MEDIA_PRESETS[action] && (
                    <button
                        type="button"
                        onClick={() => updateBinding(action, 'global', MEDIA_PRESETS[action] || '')}
                        style={{
                            height: '28px',
                            padding: '0 8px',
                            borderRadius: '5px',
                            border: '1px solid #444',
                            background: '#2b2b2b',
                            color: '#bbb',
                            fontSize: '11px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {t('settings.hotkeys.mediaKey')}
                    </button>
                )}
            </div>
            <div style={{ fontSize: '12px' }}>{renderStatus(action)}</div>
            <button
                type="button"
                title={t('settings.hotkeys.clearShortcut')}
                aria-label={t('settings.hotkeys.clearShortcut')}
                onClick={() => {
                    setHotkeys(mergeHotkeyConfig({
                        ...hotkeys,
                        bindings: {
                            ...hotkeys.bindings,
                            [action]: { local: '', global: '' },
                        },
                    }));
                }}
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #444',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    justifySelf: 'center',
                    padding: 0,
                    fontSize: 0,
                }}
            >
                <img src={RemoveIcon} alt="" style={{ width: '16px', height: '16px', display: 'block' }} />
            </button>
        </div>
    );

    return (
        <section style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                    {t('settings.hotkeys.title')}
                </h2>
                <button
                    type="button"
                    onClick={resetRecommendedDefaults}
                    title={t('settings.hotkeys.resetRecommendedTitle')}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#333',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                    }}
                >
                    {t('settings.hotkeys.resetRecommended')}
                </button>
            </div>

            <div style={{ background: '#2a2a2a', padding: '20px 24px', borderRadius: '12px', border: '1px solid #333' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', cursor: 'pointer', color: '#ddd', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={hotkeys.globalHotkeysEnabled}
                        onChange={(event) => setHotkeys(mergeHotkeyConfig({ ...hotkeys, globalHotkeysEnabled: event.target.checked }))}
                        style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px' }}
                    />
                    {t('settings.hotkeys.enableGlobal')}
                    <span style={{ color: '#888', fontSize: '12px' }}>{t('settings.hotkeys.globalDisabledDescription')}</span>
                </label>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(150px, 1fr) 128px 190px 128px 40px',
                        gap: '12px',
                        color: '#888',
                        fontSize: '12px',
                        fontWeight: 700,
                        paddingBottom: '8px',
                    }}
                >
                    <div>{t('settings.hotkeys.function')}</div>
                    <div>{t('settings.hotkeys.local')}</div>
                    <div>{t('settings.hotkeys.global')}</div>
                    <div>{t('settings.hotkeys.status.title')}</div>
                    <div />
                </div>

                {(['playback', 'custom'] as const).map((group) => (
                    <div key={group} style={{ marginTop: group === 'custom' ? '18px' : 0 }}>
                        <div style={{ color: 'var(--accent-color)', fontSize: '13px', fontWeight: 700, padding: '6px 0' }}>
                            {getHotkeyGroupLabel(t, group)}
                        </div>
                        {groupedActions[group].map(({ action }) => renderActionRow(
                            action,
                            getHotkeyActionLabel(t, action),
                            getHotkeyActionDescription(t, action)
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HotkeysSettingsSection;
