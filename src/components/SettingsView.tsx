import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import audioEngine, { OutputRole } from '../audio/AudioEngine';
import { areOutputDevicesOverlapping } from '../audio/outputRouting';
import { useUserData } from '../contexts/UserDataContext';
import CalibrationModal from './CalibrationModal';
import { getAudioOffset, loadOutputDevicePreferences, saveStreamEnabledPreference } from '../settings/devicePreferences';
import HotkeysSettingsSection from './HotkeysSettingsSection';
import OverlayTemplateSettingsSection, { OverlayTemplateEditor } from './OverlayTemplateSettingsSection';
import { OverlayKind } from '../../shared/overlayTemplates';
import WebIcon from '../assets/icons/web.svg';
import LanguageSelector from './LanguageSelector';

// Lazy loading DebugUpdaterUI
const DebugUpdaterUI = React.lazy(() => import('./DebugUpdaterUI'));
import { useUpdater } from '../contexts/UpdaterContext';

interface SettingsViewProps {
    onBack: () => void;
    streamDeviceId: string | null;
    headphoneDeviceId: string | null;
    onChangeDevice: (role: OutputRole, deviceId: string | null) => void;
    focusRequest?: { section: 'overlayTemplates'; token: number } | null;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    onBack,
    streamDeviceId,
    headphoneDeviceId,
    onChangeDevice,
    focusRequest,
}) => {
    const { t } = useTranslation();
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { separationQuality, setSeparationQuality, overlayTemplates, language, setLanguage } = useUserData();
    const [overlayEditor, setOverlayEditor] = useState<{ kind: OverlayKind; designId: string } | null>(null);
    const [overlayEditorDirty, setOverlayEditorDirty] = useState(false);

    // Calibration State
    const [showCalibration, setShowCalibration] = useState(false);
    const [currentOffset, setCurrentOffset] = useState(0);

    // Stream Toggle State
    const [streamEnabled, setStreamEnabled] = useState(false);

    // Sample Rates
    const [streamSampleRate, setStreamSampleRate] = useState(0);
    const [headphoneSampleRate, setHeadphoneSampleRate] = useState(0);

    const refreshDevices = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await audioEngine.enumerateOutputDevices();
            setDevices(list);
            // Also refresh sample rates
            setStreamSampleRate(audioEngine.getSampleRate('stream'));
            setHeadphoneSampleRate(audioEngine.getSampleRate('headphone'));
        } catch (err) {
            console.error('[Settings] Failed to enumerate devices', err);
            setError(t('settings.audio.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshDevices();
        // Load initial offset & stream enabled state
        const prefs = loadOutputDevicePreferences();
        if (prefs) {
            setCurrentOffset(getAudioOffset(streamDeviceId, headphoneDeviceId)); // refresh offset
            setStreamEnabled(prefs.isStreamEnabled ?? true);
        }
    }, []);

    useEffect(() => {
        if (focusRequest?.section === 'overlayTemplates') {
            setOverlayEditor(null);
            window.setTimeout(() => {
                document.getElementById('overlay-template-settings-section')?.scrollIntoView({ block: 'start' });
            }, 0);
        }
    }, [focusRequest?.token, focusRequest?.section]);

    const closeOverlayEditor = () => {
        if (overlayEditorDirty && !window.confirm(t('settings.overlay.unsavedLeaveConfirm'))) {
            return;
        }
        setOverlayEditorDirty(false);
        setOverlayEditor(null);
    };

    const handleBackClick = () => {
        if (overlayEditor) {
            closeOverlayEditor();
            return;
        }
        onBack();
    };

    // Update displayed offset and sample rates when devices change
    useEffect(() => {
        const saved = getAudioOffset(streamDeviceId, headphoneDeviceId);
        setCurrentOffset(saved);

        // Brief delay to ensure context updated if async (though setOutputDevice is awaited in App, here we just react/poll)
        // Ideally App calls refresh, but we can just poll the engine
        setStreamSampleRate(audioEngine.getSampleRate('stream'));
        setHeadphoneSampleRate(audioEngine.getSampleRate('headphone'));
    }, [streamDeviceId, headphoneDeviceId]);

    const handleToggleStream = (enabled: boolean) => {
        setStreamEnabled(enabled);
        saveStreamEnabledPreference(enabled);
        // Mute or Unmute
        // Default stream volume is usually 0.8 in AudioEngine init, but we can set to 1.0 or restore.
        // For simplicity: ON = 1.0, OFF = 0.
        audioEngine.setOutputVolume('stream', enabled ? 1.0 : 0);
    };

    const overlappingOutputs = streamEnabled
        && areOutputDevicesOverlapping(streamDeviceId, headphoneDeviceId);
    const calibrationEnabled = streamEnabled && !overlappingOutputs;

    const deviceOptions = useMemo(() => {
        return [
            { deviceId: '', label: t('settings.audio.systemDefault') },
            ...devices.map((d, idx) => ({
                deviceId: d.deviceId,
                label: d.label || t('settings.audio.device', { index: idx + 1 }),
            })),
        ];
    }, [devices, t]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#1f1f1f',
            color: '#fff',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                backgroundColor: '#252525',
                flexShrink: 0
            }}>
                <button
                    onClick={handleBackClick}
                    style={{
                        background: 'none',
                        border: '1px solid transparent',
                        color: '#f2f2f2',
                        cursor: 'pointer',
                        fontSize: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        transition: 'background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
                        padding: 0,
                        lineHeight: 1,
                        fontWeight: 700
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.transform = 'translateX(-1px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    ‹
                </button>
                <h1 style={{ margin: 0, fontSize: '22px', lineHeight: 1.15, fontWeight: 'bold' }}>{t('common.settings')}</h1>
            </div>

            {/* Content Container - Scrollbar lives here */}
            {overlayEditor ? (
                <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    width: '100%',
                }}>
                    <OverlayTemplateEditor
                        initialKind={overlayEditor.kind}
                        initialDesignId={overlayEditor.designId}
                        onClose={closeOverlayEditor}
                        onDirtyChange={setOverlayEditorDirty}
                    />
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    width: '100%',
                }}>
                {/* Centered Content Wrapper */}
                <div style={{
                    padding: '32px',
                    maxWidth: '800px',
                    margin: '0 auto',
                    boxSizing: 'border-box'
                }}>

                    {/* Section: Language */}
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                                src={WebIcon}
                                alt=""
                                aria-hidden="true"
                                style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)', opacity: 0.9, flexShrink: 0 }}
                            />
                            {t('settings.language.title')}
                        </h2>
                        <p style={{ margin: '0 0 16px', color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                            {t('settings.language.description')}
                        </p>
                        <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                            {t('settings.language.label')}
                        </label>
                        <LanguageSelector value={language} onChange={setLanguage} />
                    </section>

                    {/* Section: Audio Devices */}
                    <section style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                                {t('settings.audio.title')}
                            </h2>
                            <button
                                onClick={refreshDevices}
                                disabled={loading}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#333',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: '13px',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? t('settings.audio.scanning') : t('settings.audio.scan')}
                            </button>
                        </div>

                        <p style={{ margin: '0 0 24px', color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                            {t('settings.audio.description')}
                            <br />
                            {t('settings.audio.separationDescription')}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            {/* Stream Device Block */}
                            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                {/* Header with Toggle */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
                                            {t('settings.audio.streamOutput')}
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={streamEnabled}
                                                onChange={(e) => handleToggleStream(e.target.checked)}
                                                style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                        </label>
                                    </div>
                                    {streamSampleRate > 0 && (
                                        <div style={{
                                            fontSize: '11px',
                                            color: '#aaa',
                                            backgroundColor: '#383838',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            border: '1px solid #555'
                                        }}>
                                            {streamSampleRate} Hz
                                        </div>
                                    )}
                                </div>

                                {/* Content: Select (Disabled if Stream OFF) */}
                                <div style={{
                                    opacity: streamEnabled ? 1 : 0.4,
                                    pointerEvents: streamEnabled ? 'auto' : 'none',
                                    transition: 'opacity 0.2s'
                                }}>
                                    <select
                                        value={streamDeviceId ?? ''}
                                        onChange={(e) => onChangeDevice('stream', e.target.value || null)}
                                        disabled={!streamEnabled}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            background: '#1f1f1f',
                                            color: '#fff',
                                            border: '1px solid #444',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            cursor: !streamEnabled ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {deviceOptions.map((opt) => (
                                            <option key={opt.deviceId} value={opt.deviceId}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
                                        {t('settings.audio.headphoneOutput')}
                                    </label>
                                    {headphoneSampleRate > 0 && (
                                        <div style={{
                                            fontSize: '11px',
                                            color: '#aaa',
                                            backgroundColor: '#383838',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            border: '1px solid #555'
                                        }}>
                                            {headphoneSampleRate} Hz
                                        </div>
                                    )}
                                </div>
                                <select
                                    value={headphoneDeviceId ?? ''}
                                    onChange={(e) => onChangeDevice('headphone', e.target.value || null)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: '#1f1f1f',
                                        color: '#fff',
                                        border: '1px solid #444',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                >
                                    {deviceOptions.map((opt) => (
                                        <option key={opt.deviceId} value={opt.deviceId}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {overlappingOutputs && (
                            <div
                                role="status"
                                style={{
                                    marginBottom: '16px',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 190, 80, 0.45)',
                                    background: 'rgba(255, 190, 80, 0.1)',
                                    color: '#f5d28a',
                                    fontSize: '13px',
                                    lineHeight: '1.5',
                                }}
                            >
                                {t('settings.audio.overlappingOutputWarning')}
                            </div>
                        )}

                        {/* Calibration Row - Disabled if Stream OFF */}
                        <div style={{
                            background: '#2a2a2a',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            border: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            opacity: calibrationEnabled ? 1 : 0.4,
                            pointerEvents: calibrationEnabled ? 'auto' : 'none',
                            transition: 'opacity 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '14px', color: '#ddd', fontWeight: 'bold' }}>{t('settings.audio.syncOffset')}</div>
                                <div style={{
                                    fontSize: '14px',
                                    color: currentOffset === 0 ? '#aaa' : 'var(--accent-color)',
                                    fontFamily: 'monospace'
                                }}>
                                    {currentOffset > 0 ? `+${currentOffset}` : currentOffset} ms
                                </div>
                            </div>

                            <button
                                onClick={() => setShowCalibration(true)}
                                disabled={!calibrationEnabled}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#444',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: !calibrationEnabled ? 'not-allowed' : 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                {t('settings.audio.calibrate')}
                            </button>
                        </div>

                        {error && <div style={{ color: '#ff6666', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
                    </section>

                    <OverlayTemplateSettingsSection
                        onOpenEditor={(kind, designId) => setOverlayEditor({
                            kind,
                            designId: designId ?? (kind === 'lyrics' ? overlayTemplates.activeLyricsDesignId : overlayTemplates.activeSetlistDesignId)
                        })}
                    />

                    <HotkeysSettingsSection />

                    {/* Section: Processing */}
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                            {t('settings.separation.title')}
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <input
                                        type="radio"
                                        name="separationQuality"
                                        value="fast"
                                        checked={separationQuality === 'fast'}
                                        onChange={() => setSeparationQuality('fast')}
                                        style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>{t('settings.separation.fast')}</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>{t('settings.separation.fastDescription')}</div>
                                    </div>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <input
                                        type="radio"
                                        name="separationQuality"
                                        value="normal"
                                        checked={separationQuality === 'normal'}
                                        onChange={() => setSeparationQuality('normal')}
                                        style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>{t('settings.separation.normal')}</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>{t('settings.separation.normalDescription')}</div>
                                    </div>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <input
                                        type="radio"
                                        name="separationQuality"
                                        value="high"
                                        checked={separationQuality === 'high'}
                                        onChange={() => setSeparationQuality('high')}
                                        style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>{t('settings.separation.high')}</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>{t('settings.separation.highDescription')}</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Section: Software Update */}
                    <section>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                            {t('settings.updates.title')}
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
                                        {t('settings.updates.check')}
                                    </div>
                                    <LastCheckedText />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {/* Dev Mode Debug UI embedded */}
                                    <Suspense fallback={null}>
                                        <DebugUpdaterUI inline />
                                    </Suspense>
                                    <CheckForUpdatesButton />
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
                </div>
            )}

            {showCalibration && (
                <CalibrationModal
                    onClose={() => setShowCalibration(false)}
                    streamDeviceId={streamDeviceId}
                    headphoneDeviceId={headphoneDeviceId}
                    initialOffset={currentOffset}
                    onOffsetChange={setCurrentOffset}
                />
            )}
        </div>
    );
};

const LastCheckedText: React.FC = () => {
    const { t } = useTranslation();
    const { lastCheckTime } = useUpdater();

    if (!lastCheckTime) return <div style={{ color: '#aaa', fontSize: '13px' }}>{t('settings.updates.neverChecked')}</div>;

    const date = new Date(lastCheckTime);
    const timeString = date.toLocaleString(); // Or simpler formatting

    return <div style={{ color: '#aaa', fontSize: '13px' }}>{t('settings.updates.lastChecked', { time: timeString })}</div>;
};

// Sub-component for clean context usage
const CheckForUpdatesButton: React.FC = () => {
    const { t } = useTranslation();
    const { checkForUpdates, downloadUpdate, installUpdate, status } = useUpdater();
    const isBusy = status === 'checking' || status === 'downloading' || status === 'installing';
    const label = status === 'checking'
        ? t('settings.updates.checking')
        : status === 'downloading'
            ? t('updatesPopup.status.downloading')
            : status === 'installing'
                ? t('updatesPopup.status.installing')
                : status === 'available'
                    ? t('updatesPopup.updateNow')
                    : status === 'downloaded'
                        ? t('updatesPopup.restart')
                        : t('settings.updates.check');
    const handleClick = () => {
        if (status === 'available') {
            downloadUpdate();
            return;
        }
        if (status === 'downloaded') {
            installUpdate();
            return;
        }
        checkForUpdates(true);
    };

    return (
        <button
            onClick={handleClick}
            disabled={isBusy}
            style={{
                background: 'transparent',
                border: '1px solid #555',
                color: '#aaa',
                borderRadius: '8px',
                cursor: isBusy ? 'wait' : 'pointer',
                fontSize: '14px',
                padding: '8px 20px',
            }}
        >
            {label}
        </button>
    );
};


export default SettingsView;
