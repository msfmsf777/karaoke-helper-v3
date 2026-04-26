import React, { useEffect, useMemo, useState } from 'react';
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

type HotkeyScope = 'local' | 'global';

const GROUP_LABELS = {
    playback: '播放控制',
    custom: '自訂快捷鍵',
};

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
    const { hotkeys, setHotkeys } = useUserData();
    const [recording, setRecording] = useState<{ action: HotkeyAction; scope: HotkeyScope } | null>(null);
    const [status, setStatus] = useState<HotkeyRegistrationStatus | null>(null);

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
    }, [recording, hotkeys]);

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

    const updateBinding = (action: HotkeyAction, scope: HotkeyScope, accelerator: string) => {
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
    };

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
        if (globalDuplicates.has(action)) return <span style={{ color: '#ff7777' }}>重複快捷鍵</span>;
        const globalAccelerator = hotkeys.bindings[action].global;
        if (globalAccelerator && isPlainGlobalAccelerator(globalAccelerator)) {
            return <span style={{ color: '#ff7777' }}>全域快捷鍵需包含修飾鍵</span>;
        }
        if (localDuplicates.has(action)) return <span style={{ color: '#ffb86c' }}>本機快捷鍵重複</span>;
        if (!hotkeys.globalHotkeysEnabled && globalAccelerator) return <span style={{ color: '#888' }}>全域快捷鍵未啟用</span>;
        if (status?.failed[action]) return <span style={{ color: '#ff7777' }}>{status.failed[action]}</span>;
        if (hotkeys.globalHotkeysEnabled && globalAccelerator && status?.registered[action]) {
            return <span style={{ color: '#8be28b' }}>已套用</span>;
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
                title={isRecording ? '按下快捷鍵，Esc 取消，Backspace 清除' : '點擊後輸入快捷鍵'}
            >
                {isRecording ? '請按快捷鍵...' : formatAccelerator(value)}
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
                        媒體鍵
                    </button>
                )}
            </div>
            <div style={{ fontSize: '12px' }}>{renderStatus(action)}</div>
            <button
                type="button"
                title="清除這個快捷鍵設定"
                aria-label="清除這個快捷鍵設定"
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
                清除
            </button>
        </div>
    );

    return (
        <section style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                    快捷鍵
                </h2>
                <button
                    type="button"
                    onClick={resetRecommendedDefaults}
                    title="只還原有建議預設值的快捷鍵，不會覆蓋未設定預設值的自訂快捷鍵"
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
                    還原建議預設
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
                    啟用全域快捷鍵
                    <span style={{ color: '#888', fontSize: '12px' }}>關閉時只會在 KHelper 視窗內生效</span>
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
                    <div>功能</div>
                    <div>本機快捷鍵</div>
                    <div>全域快捷鍵</div>
                    <div>狀態</div>
                    <div />
                </div>

                {(['playback', 'custom'] as const).map((group) => (
                    <div key={group} style={{ marginTop: group === 'custom' ? '18px' : 0 }}>
                        <div style={{ color: 'var(--accent-color)', fontSize: '13px', fontWeight: 700, padding: '6px 0' }}>
                            {GROUP_LABELS[group]}
                        </div>
                        {groupedActions[group].map(({ action, label, description }) => renderActionRow(action, label, description))}
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HotkeysSettingsSection;
