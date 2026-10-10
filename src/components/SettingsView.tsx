import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
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
import VolumeHighIcon from '../assets/icons/volume_high.svg';
import HeadphoneIcon from '../assets/icons/headphone.svg';
import PitchIcon from '../assets/icons/pitch.svg';
import SeparateIcon from '../assets/icons/separate.svg';
import ShieldIcon from '../assets/icons/shield.svg';
import UpdateBaseIcon from '../assets/icons/update_base.svg';
import MicIcon from '../assets/icons/mic.svg';
import LanguageSelector from './LanguageSelector';
import { PRIVACY_NOTICE_URL, TELEMETRYDECK_PRIVACY_URL } from '../constants/privacy';

// Lazy loading DebugUpdaterUI
const DebugUpdaterUI = React.lazy(() => import('./DebugUpdaterUI'));
import { useUpdater } from '../contexts/UpdaterContext';
import { StorageSettingsSection } from './StorageSettingsSection';
import { SeparationSettingsSection } from './SeparationSettingsSection';
import { VocalRangeSetupModal } from './VocalRangeSetupModal';
import type { LoudnessPreset } from '../audio/loudness';

interface SettingsViewProps {
    onBack: () => void;
    streamDeviceId: string | null;
    headphoneDeviceId: string | null;
    onChangeDevice: (role: OutputRole, deviceId: string | null) => void;
    focusRequest?: { section: 'overlayTemplates'; token: number } | null;
}

const privacyLinkStyle: React.CSSProperties = {
    border: 0,
    padding: 0,
    background: 'transparent',
    color: '#70bbff',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
};

const sectionHeadingStyle: React.CSSProperties = {
    margin: '0 0 16px',
    fontSize: '18px',
    color: '#fff',
    borderLeft: '4px solid var(--accent-color)',
    paddingLeft: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const headingIconStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
    filter: 'brightness(0) invert(1)',
    opacity: 0.9,
    flexShrink: 0,
};

const NAV_ITEMS = [
    { id: 'settings-language', labelKey: 'settings.nav.language' },
    { id: 'settings-audio', labelKey: 'settings.nav.audio' },
    { id: 'settings-vocal-range', labelKey: 'settings.nav.vocalRange' },
    { id: 'overlay-template-settings-section', labelKey: 'settings.nav.overlays' },
    { id: 'settings-hotkeys', labelKey: 'settings.nav.hotkeys' },
    { id: 'settings-separation', labelKey: 'settings.nav.separation' },
    { id: 'settings-storage', labelKey: 'settings.nav.storage' },
    { id: 'settings-privacy', labelKey: 'settings.nav.privacy' },
    { id: 'settings-updates', labelKey: 'settings.nav.updates' },
];

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
    const {
        separationQuality,
        setSeparationQuality,
        overlayTemplates,
        language,
        setLanguage,
        analytics,
        setAnalytics,
        vocalRange,
        vocalRangeAutoShow,
        setVocalRangeAutoShow,
        volumeNormalization,
        setVolumeNormalization,
        targetLoudnessPreset,
        setTargetLoudnessPreset,
        targetLoudnessCustom,
        setTargetLoudnessCustom,
    } = useUserData();
    const [overlayEditor, setOverlayEditor] = useState<{ kind: OverlayKind; designId: string } | null>(null);
    const [overlayEditorDirty, setOverlayEditorDirty] = useState(false);
    const [analyticsSaving, setAnalyticsSaving] = useState(false);
    const [analyticsError, setAnalyticsError] = useState(false);
    const overlapReportedRef = useRef(false);

    // Vocal Range Modal State
    const [showVocalRangeModal, setShowVocalRangeModal] = useState(false);

    // Calibration State
    const [showCalibration, setShowCalibration] = useState(false);
    const [currentOffset, setCurrentOffset] = useState(0);

    // Stream Toggle State
    const [streamEnabled, setStreamEnabled] = useState(false);

    // Sample Rates
    const [streamSampleRate, setStreamSampleRate] = useState(0);
    const [headphoneSampleRate, setHeadphoneSampleRate] = useState(0);

    // Navigation State
    const [activeSection, setActiveSection] = useState<string>('settings-language');
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const isClickScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<number | null>(null);

    const scrollToSection = (id: string) => {
        const container = scrollContainerRef.current;
        const el = document.getElementById(id);
        if (!container || !el) return;

        setActiveSection(id);
        isClickScrollingRef.current = true;
        if (scrollTimeoutRef.current) {
            window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
            isClickScrollingRef.current = false;
        }, 850);

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop = container.scrollTop + (elRect.top - containerRect.top) - 20;

        container.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        if (overlayEditor) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (isClickScrollingRef.current) return;
                const visible = entries.find((e) => e.isIntersecting);
                if (visible?.target?.id) {
                    setActiveSection(visible.target.id);
                }
            },
            {
                root: container,
                rootMargin: '-10% 0px -70% 0px',
                threshold: 0,
            }
        );

        NAV_ITEMS.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) observer.observe(el);
        });

        return () => {
            observer.disconnect();
            if (scrollTimeoutRef.current) {
                window.clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [overlayEditor]);

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

    useEffect(() => {
        if (overlappingOutputs && !overlapReportedRef.current) {
            overlapReportedRef.current = true;
            void window.khelper?.analytics.track({ type: 'Audio.OutputSafetyTriggered', reason: 'overlapping_devices' });
        } else if (!overlappingOutputs) {
            overlapReportedRef.current = false;
        }
    }, [overlappingOutputs]);

    const handleAnalyticsChange = async (enabled: boolean) => {
        if (!window.khelper?.analytics || analyticsSaving) return;
        setAnalyticsSaving(true);
        setAnalyticsError(false);
        try {
            const saved = await window.khelper.analytics.setConsent(enabled ? 'enabled' : 'disabled');
            setAnalytics(saved);
        } catch (err) {
            console.error('[Settings] Failed to update analytics preference', err);
            setAnalyticsError(true);
        } finally {
            setAnalyticsSaving(false);
        }
    };

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

            {/* Category Navigation Bar */}
            {!overlayEditor && (
                <nav
                    aria-label={t('common.settings')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 24px',
                        backgroundColor: '#232323',
                        borderBottom: '1px solid #333',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        scrollbarWidth: 'none',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: '0 auto',
                    }}>
                        {NAV_ITEMS.map((item) => {
                            const isActive = activeSection === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => scrollToSection(item.id)}
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: '16px',
                                        border: '1px solid ' + (isActive ? 'var(--accent-color)' : 'transparent'),
                                        backgroundColor: isActive ? 'rgba(var(--accent-color-rgb), 0.16)' : '#2c2c2c',
                                        color: isActive ? '#fff' : '#aaa',
                                        fontSize: '12px',
                                        fontWeight: isActive ? 600 : 500,
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = '#383838';
                                            e.currentTarget.style.color = '#fff';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = '#2c2c2c';
                                            e.currentTarget.style.color = '#aaa';
                                        }
                                    }}
                                >
                                    {t(item.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            )}

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
                <div
                    ref={scrollContainerRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        width: '100%',
                    }}
                >
                {/* Centered Content Wrapper */}
                <div style={{
                    padding: '32px',
                    maxWidth: '800px',
                    margin: '0 auto',
                    boxSizing: 'border-box'
                }}>

                    {/* Section: Language */}
                    <section id="settings-language" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
                        <h2 style={sectionHeadingStyle}>
                            <img
                                src={WebIcon}
                                alt=""
                                aria-hidden="true"
                                style={headingIconStyle}
                            />
                            <span>{t('settings.language.title')}</span>
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <p style={{ margin: '0 0 16px', color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                                {t('settings.language.description')}
                            </p>
                            <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                                {t('settings.language.label')}
                            </label>
                            <LanguageSelector value={language} onChange={setLanguage} />
                        </div>
                    </section>

                    {/* Section: Audio Devices */}
                    <section id="settings-audio" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={sectionHeadingStyle}>
                                <img
                                    src={HeadphoneIcon}
                                    alt=""
                                    aria-hidden="true"
                                    style={headingIconStyle}
                                />
                                <span>{t('settings.audio.title')}</span>
                            </h2>
                            <button
                                onClick={refreshDevices}
                                disabled={loading}
                                style={{
                                    padding: '6px 14px',
                                    backgroundColor: '#333',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: '13px',
                                    opacity: loading ? 0.7 : 1,
                                    transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#3f3f3f'; }}
                                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#333'; }}
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={streamEnabled}
                                            onChange={(e) => handleToggleStream(e.target.checked)}
                                            style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <span style={{ color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
                                            {t('settings.audio.streamOutput')}
                                        </span>
                                    </label>
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
                                    padding: '7px 16px',
                                    backgroundColor: '#333',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    border: '1px solid #444',
                                    cursor: !calibrationEnabled ? 'not-allowed' : 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={e => { if (calibrationEnabled) e.currentTarget.style.backgroundColor = '#3f3f3f'; }}
                                onMouseLeave={e => { if (calibrationEnabled) e.currentTarget.style.backgroundColor = '#333'; }}
                            >
                                {t('settings.audio.calibrate')}
                            </button>
                        </div>

                        {/* Volume Normalization Card */}
                        <div style={{
                            background: '#2a2a2a',
                            padding: '20px',
                            borderRadius: '12px',
                            border: '1px solid #333',
                            marginTop: '16px',
                        }}>
                            {/* Header Row: Toggle in front of Title & Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={volumeNormalization}
                                        onChange={(e) => setVolumeNormalization(e.target.checked)}
                                        style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img
                                            src={VolumeHighIcon}
                                            alt=""
                                            aria-hidden="true"
                                            style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
                                        />
                                        <span>{t('settings.audio.normalization.title', '音量正規化 (Volume Normalization)')}</span>
                                    </span>
                                </label>
                                <div style={{ fontSize: '13px', color: '#aaa', marginLeft: '28px', lineHeight: '1.5' }}>
                                    {t('settings.audio.normalization.description', '自動校準所有歌曲至一致的感知響度 (LUFS)，確保直播與監聽音量平衡，並附帶透明安全防爆音限制器。')}
                                </div>
                            </div>

                            {/* Preset Selection & Slider (Shown when Normalization is ON) */}
                            {volumeNormalization && (
                                <div style={{
                                    marginTop: '16px',
                                    paddingTop: '16px',
                                    borderTop: '1px solid #383838',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px',
                                }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#ddd', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                                            {t('settings.audio.normalization.presetLabel', '目標響度預設 (Target Loudness)')}
                                        </label>
                                        <select
                                            value={targetLoudnessPreset}
                                            onChange={(e) => setTargetLoudnessPreset(e.target.value as LoudnessPreset)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                background: '#1f1f1f',
                                                color: '#fff',
                                                border: '1px solid #444',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                outline: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="standard">
                                                {t('settings.audio.normalization.presetStandard', '標準平衡 (-14 LUFS · YouTube / Spotify 推薦)')}
                                            </option>
                                            <option value="voice_priority">
                                                {t('settings.audio.normalization.presetVoice', '人聲優先 (-16 LUFS · Twitch 直播凸顯麥克風)')}
                                            </option>
                                            <option value="gentle">
                                                {t('settings.audio.normalization.presetGentle', '輕柔保護 (-18 LUFS · 長時間歌回防疲勞)')}
                                            </option>
                                            <option value="custom">
                                                {t('settings.audio.normalization.presetCustom', '自訂響度 (Other / Custom)')}
                                            </option>
                                        </select>
                                    </div>

                                    {/* Custom Slider (Visible when preset is 'custom') */}
                                    {targetLoudnessPreset === 'custom' && (
                                        <div style={{
                                            background: '#222',
                                            padding: '14px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid #333',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '13px', color: '#ddd', fontWeight: 'bold' }}>
                                                    {t('settings.audio.normalization.customValue', '自訂目標響度')}
                                                </span>
                                                <span style={{
                                                    fontSize: '13px',
                                                    color: 'var(--accent-color)',
                                                    fontFamily: 'monospace',
                                                    fontWeight: 'bold',
                                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                }}>
                                                    {targetLoudnessCustom > 0 ? `+${targetLoudnessCustom.toFixed(1)}` : targetLoudnessCustom.toFixed(1)} LUFS
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '12px', color: '#777', width: '60px' }}>-20.0 LUFS</span>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="-10"
                                                    step="0.5"
                                                    value={targetLoudnessCustom}
                                                    onChange={(e) => setTargetLoudnessCustom(parseFloat(e.target.value))}
                                                    style={{
                                                        flex: 1,
                                                        accentColor: 'var(--accent-color)',
                                                        cursor: 'pointer',
                                                    }}
                                                />
                                                <span style={{ fontSize: '12px', color: '#777', width: '60px', textAlign: 'right' }}>-10.0 LUFS</span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                                                {t('settings.audio.normalization.customHint', '數值愈大音量愈響（上限 -10 LUFS 保護動態）；數值愈小音量愈輕柔。')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {error && <div style={{ color: '#ff6666', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
                    </section>

                    {/* Section: Singing & Vocal Range */}
                    <section id="settings-vocal-range" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
                        <h2 style={sectionHeadingStyle}>
                            <img
                                src={PitchIcon}
                                alt=""
                                aria-hidden="true"
                                style={headingIconStyle}
                            />
                            <span>{t('settings.vocalRange.sectionTitle', '演唱與音域')}</span>
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <p style={{ margin: '0 0 18px', color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                                {t('settings.vocalRange.sectionDesc', '設定您的個人演唱音域，系統將為伴奏音訊提供專屬智慧轉調建議。')}
                            </p>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 20px',
                                backgroundColor: '#222',
                                borderRadius: '8px',
                                border: '1px solid #333',
                            }}>
                                <div>
                                    <div style={{ fontSize: '14px', color: '#ddd', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img
                                            src={MicIcon}
                                            alt=""
                                            aria-hidden="true"
                                            style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
                                        />
                                        <span>{t('vocalRange.settings.title', '個人音域 (Vocal Range Profile)')}</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', marginLeft: '24px' }}>
                                        {vocalRange
                                            ? t('vocalRange.settings.configured', { range: `${vocalRange.lowestNote} ~ ${vocalRange.highestNote}` })
                                            : t('vocalRange.settings.unconfigured')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowVocalRangeModal(true)}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#22c55e',
                                        color: '#fff',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        transition: 'filter 0.15s ease',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                    onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                                >
                                    {vocalRange ? t('vocalRange.settings.modify', '修改音域') : t('vocalRange.settings.setup', '設定音域')}
                                </button>
                            </div>

                            {/* Minimal selector to disable/enable auto popout - Checkbox in front of text */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 20px',
                                backgroundColor: '#222',
                                borderRadius: '8px',
                                marginTop: '10px',
                                border: '1px solid #333',
                            }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', margin: 0, flex: 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={vocalRangeAutoShow}
                                        onChange={(e) => setVocalRangeAutoShow(e.target.checked)}
                                        style={{
                                            accentColor: '#22c55e',
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            marginTop: '2px',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div>
                                        <div style={{ fontSize: '13px', color: '#eee', fontWeight: 600 }}>
                                            {t('vocalRange.settings.autoShowTitle', '自動彈出歌曲音域 (Auto-popout Vocal Range)')}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                                            {t('vocalRange.settings.autoShowDesc', '開啟時，於切歌或打開調性調整選單時自動顯示音域膠囊；關閉後僅能透過歌詞框頂部按鈕手動打開')}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>

                    <OverlayTemplateSettingsSection
                        onOpenEditor={(kind, designId) => setOverlayEditor({
                            kind,
                            designId: designId ?? (kind === 'lyrics' ? overlayTemplates.activeLyricsDesignId : overlayTemplates.activeSetlistDesignId)
                        })}
                    />

                    <HotkeysSettingsSection />

                    {/* Section: Vocal Separation */}
                    <section id="settings-separation" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
                        <h2 style={sectionHeadingStyle}>
                            <img
                                src={SeparateIcon}
                                alt=""
                                aria-hidden="true"
                                style={headingIconStyle}
                            />
                            <span>{t('settings.separation.title')}</span>
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <SeparationSettingsSection />
                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #383838' }}>
                                <div style={{ fontSize: '14px', color: '#ddd', fontWeight: 600, marginBottom: '12px' }}>
                                    {t('settings.separation.qualitySubtitle', '預設分離品質')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.15s ease' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <input
                                            type="radio"
                                            name="separationQuality"
                                            value="fast"
                                            checked={separationQuality === 'fast'}
                                            onChange={() => setSeparationQuality('fast')}
                                            style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{t('settings.separation.fast')}</div>
                                            <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>{t('settings.separation.fastDescription')}</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.15s ease' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <input
                                            type="radio"
                                            name="separationQuality"
                                            value="normal"
                                            checked={separationQuality === 'normal'}
                                            onChange={() => setSeparationQuality('normal')}
                                            style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{t('settings.separation.normal')}</div>
                                            <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>{t('settings.separation.normalDescription')}</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.15s ease' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <input
                                            type="radio"
                                            name="separationQuality"
                                            value="high"
                                            checked={separationQuality === 'high'}
                                            onChange={() => setSeparationQuality('high')}
                                            style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{t('settings.separation.high')}</div>
                                            <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>{t('settings.separation.highDescription')}</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: Song Library Storage */}
                    <StorageSettingsSection />

                    {/* Section: Privacy & Improvement */}
                    <section id="settings-privacy" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
                        <h2 style={sectionHeadingStyle}>
                            <img
                                src={ShieldIcon}
                                alt=""
                                aria-hidden="true"
                                style={headingIconStyle}
                            />
                            <span>{t('settings.privacy.title')}</span>
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <p style={{ margin: '0 0 18px', color: '#aaa', fontSize: '14px', lineHeight: 1.6 }}>
                                {t('settings.privacy.description')}
                            </p>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: analyticsSaving ? 'wait' : 'pointer', marginBottom: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={analytics.consent === 'enabled'}
                                    disabled={analyticsSaving}
                                    onChange={(event) => void handleAnalyticsChange(event.target.checked)}
                                    style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px', cursor: analyticsSaving ? 'wait' : 'pointer' }}
                                />
                                <span style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                                    {t('settings.privacy.shareUsage')}
                                </span>
                            </label>
                            <p style={{ margin: '0 0 18px', color: analytics.consent === 'enabled' ? '#76d394' : '#aaa', fontSize: '13px' }}>
                                {t(analytics.consent === 'enabled' ? 'settings.privacy.enabled' : 'settings.privacy.disabled')}
                            </p>
                            <p style={{ margin: '0 0 8px', color: '#c9c9c9', fontSize: '13px', lineHeight: 1.55 }}>
                                {t('settings.privacy.collected')}
                            </p>
                            <p style={{ margin: '0 0 18px', color: '#c9c9c9', fontSize: '13px', lineHeight: 1.55 }}>
                                {t('settings.privacy.notCollected')}
                            </p>
                            {analyticsError && (
                                <div role="alert" style={{ color: '#ff8e8e', fontSize: '13px', marginBottom: '16px' }}>
                                    {t('settings.privacy.saveError')}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                <button type="button" onClick={() => void window.api.openExternal(PRIVACY_NOTICE_URL)} style={privacyLinkStyle}>
                                    {t('settings.privacy.privacyNotice')}
                                </button>
                                <button type="button" onClick={() => void window.api.openExternal(TELEMETRYDECK_PRIVACY_URL)} style={privacyLinkStyle}>
                                    {t('settings.privacy.providerPrivacy')}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Section: Software Update */}
                    <section id="settings-updates" style={{ scrollMarginTop: 24 }}>
                        <h2 style={sectionHeadingStyle}>
                            <img
                                src={UpdateBaseIcon}
                                alt=""
                                aria-hidden="true"
                                style={headingIconStyle}
                            />
                            <span>{t('settings.updates.title')}</span>
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

            {showVocalRangeModal && (
                <VocalRangeSetupModal
                    onClose={() => setShowVocalRangeModal(false)}
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

    const isPrimary = status === 'available' || status === 'downloaded';

    return (
        <button
            onClick={handleClick}
            disabled={isBusy}
            style={{
                background: isPrimary ? 'var(--accent-color)' : '#333',
                border: '1px solid ' + (isPrimary ? 'var(--accent-color)' : '#444'),
                color: '#fff',
                borderRadius: '6px',
                cursor: isBusy ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: isPrimary ? 600 : 500,
                padding: '7px 18px',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
                if (!isBusy && !isPrimary) e.currentTarget.style.backgroundColor = '#3f3f3f';
            }}
            onMouseLeave={e => {
                if (!isBusy && !isPrimary) e.currentTarget.style.backgroundColor = '#333';
            }}
        >
            {label}
        </button>
    );
};


export default SettingsView;
