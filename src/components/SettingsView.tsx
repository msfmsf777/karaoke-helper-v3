import React, { useEffect, useMemo, useState, Suspense } from 'react';
import audioEngine, { OutputRole } from '../audio/AudioEngine';
import { useUserData } from '../contexts/UserDataContext';

import CalibrationModal from './CalibrationModal';
import { getAudioOffset } from '../settings/devicePreferences';

// Lazy loading DebugUpdaterUI
const DebugUpdaterUI = React.lazy(() => import('./DebugUpdaterUI'));
import { useUpdater } from '../contexts/UpdaterContext';

interface SettingsViewProps {
    onBack: () => void;
    streamDeviceId: string | null;
    headphoneDeviceId: string | null;
    onChangeDevice: (role: OutputRole, deviceId: string | null) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    onBack,
    streamDeviceId,
    headphoneDeviceId,
    onChangeDevice,
}) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { separationQuality, setSeparationQuality } = useUserData();

    // Calibration State
    const [showCalibration, setShowCalibration] = useState(false);
    const [currentOffset, setCurrentOffset] = useState(0);

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
            setError('無法取得音訊輸出裝置清單');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshDevices();
        // Load initial offset
        const saved = getAudioOffset(streamDeviceId, headphoneDeviceId);
        setCurrentOffset(saved);
    }, []);

    // Update displayed offset and sample rates when devices change
    useEffect(() => {
        const saved = getAudioOffset(streamDeviceId, headphoneDeviceId);
        setCurrentOffset(saved);

        // Brief delay to ensure context updated if async (though setOutputDevice is awaited in App, here we just react/poll)
        // Ideally App calls refresh, but we can just poll the engine
        setStreamSampleRate(audioEngine.getSampleRate('stream'));
        setHeadphoneSampleRate(audioEngine.getSampleRate('headphone'));
    }, [streamDeviceId, headphoneDeviceId]);

    const deviceOptions = useMemo(() => {
        return [
            { deviceId: '', label: '系統預設' },
            ...devices.map((d, idx) => ({
                deviceId: d.deviceId,
                label: d.label || `裝置 ${idx + 1}`,
            })),
        ];
    }, [devices]);

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
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: '#252525',
                flexShrink: 0
            }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        transition: 'background 0.2s',
                        padding: 0,
                        lineHeight: 1
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    ‹
                </button>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>設定</h1>
            </div>

            {/* Content Container - Scrollbar lives here */}
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

                    {/* Section: Audio Devices */}
                    <section style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                                音訊輸出裝置
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
                                {loading ? '掃描中...' : '重新掃描'}
                            </button>
                        </div>

                        <p style={{ margin: '0 0 24px', color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                            設定觀眾聽到（Stream）與您自己聽到（Headphone）的聲音輸出位置。
                            <br />
                            若歌曲已進行人聲分離，Stream 只會輸出伴奏，而 Headphone 會同時輸出人聲與伴奏。
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
                                        觀眾輸出 (Stream)
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
                                <select
                                    value={streamDeviceId ?? ''}
                                    onChange={(e) => onChangeDevice('stream', e.target.value || null)}
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

                            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ display: 'block', color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
                                        耳機輸出 (Headphone)
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

                        {/* Calibration Row */}
                        <div style={{
                            background: '#2a2a2a',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            border: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '14px', color: '#ddd', fontWeight: 'bold' }}>雙輸出同步偏移：</div>
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
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#444',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                校準
                            </button>
                        </div>

                        {error && <div style={{ color: '#ff6666', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
                    </section>

                    {/* Section: Processing */}
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                            人聲分離品質
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
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>快速 (Fast)</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>較省資源，處理速度最快，但音質略低。</div>
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
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>標準 (Normal)</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>推薦選項。在速度與音質之間取得平衡。</div>
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
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>高品質 (High)</div>
                                        <div style={{ color: '#aaa', fontSize: '13px' }}>處理時間較長，但能提供最佳的分離效果。</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Section: Software Update */}
                    <section>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: '12px' }}>
                            軟體更新
                        </h2>
                        <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
                                        檢查更新
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
    const { lastCheckTime } = useUpdater();

    if (!lastCheckTime) return <div style={{ color: '#aaa', fontSize: '13px' }}>尚未檢查</div>;

    const date = new Date(lastCheckTime);
    const timeString = date.toLocaleString(); // Or simpler formatting

    return <div style={{ color: '#aaa', fontSize: '13px' }}>上次檢查時間：{timeString}</div>;
};

// Sub-component for clean context usage
const CheckForUpdatesButton: React.FC = () => {
    const { checkForUpdates, status } = useUpdater();

    return (
        <button
            onClick={() => checkForUpdates(true)}
            disabled={status === 'checking'}
            style={{
                background: 'transparent',
                border: '1px solid #555',
                color: '#aaa',
                borderRadius: '8px',
                cursor: status === 'checking' ? 'wait' : 'pointer',
                fontSize: '14px',
                padding: '8px 20px',
            }}
        >
            {status === 'checking' ? '檢查中...' : '檢查更新'}
        </button>
    );
};


export default SettingsView;
