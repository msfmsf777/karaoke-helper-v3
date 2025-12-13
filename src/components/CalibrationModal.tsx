import React, { useEffect, useState, useRef } from 'react';
import audioEngine, { DualAudioEngine, AudioEngine } from '../audio/AudioEngine';
import { saveAudioOffset } from '../settings/devicePreferences';

interface CalibrationModalProps {
    onClose: () => void;
    streamDeviceId: string | null;
    headphoneDeviceId: string | null;
    initialOffset: number;
    onOffsetChange: (newOffset: number) => void;
}

// Generate a simple click track (2 clicks per second, 120BPM equivalent)
// 1 second long buffer, click at 0.0 and 0.5
const generateClickBlob = () => {
    const sampleRate = 44100;
    const duration = 1.0; // 1 second loop
    const totalFrames = sampleRate * duration;

    const buffer = new ArrayBuffer(44 + totalFrames * 2); // 16-bit mono
    const view = new DataView(buffer);

    // WAV Header
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalFrames * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 Channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, totalFrames * 2, true);

    const clickDurationFrames = Math.floor(sampleRate * 0.005); // 5ms click
    const interval = Math.floor(sampleRate * 0.5); // Every 0.5s

    const writeSample = (index: number, value: number) => {
        const s = Math.max(-1, Math.min(1, value));
        view.setInt16(44 + index * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    };

    for (let i = 0; i < totalFrames; i++) {
        let sample = 0;
        const posInInterval = i % interval;
        if (posInInterval < clickDurationFrames) {
            const t = posInInterval / sampleRate;
            const freq = 1000;
            const decay = 1 - (posInInterval / clickDurationFrames);
            sample = Math.sin(2 * Math.PI * freq * t) * decay * 0.8;
        }
        writeSample(i, sample);
    }

    return new Blob([buffer], { type: 'audio/wav' });
};

const CalibrationModal: React.FC<CalibrationModalProps> = ({
    onClose,
    streamDeviceId,
    headphoneDeviceId,
    initialOffset,
    onOffsetChange
}) => {
    const [offset, setOffset] = useState(initialOffset);
    const [isPlaying, setIsPlaying] = useState(false);
    const [clickBlobUrl, setClickBlobUrl] = useState<string | null>(null);

    // Dedicated audio engine for calibration to avoid interference with main player
    const engineRef = useRef<DualAudioEngine | null>(null);
    const loopRef = useRef<number>();
    const beatRef = useRef<HTMLDivElement>(null);

    // Initialize Engine
    useEffect(() => {
        const engine = new DualAudioEngine();
        engineRef.current = engine;

        // Configure devices
        engine.setOutputDevice('stream', streamDeviceId);
        engine.setOutputDevice('headphone', headphoneDeviceId);

        // Configure offset
        engine.setOffset(initialOffset);

        // Disable Internal Loop (we will handle it manually)
        engine.setLoop(false);

        return () => {
            if (engineRef.current) {
                engineRef.current.stop();
                if (typeof (engineRef.current as any).dispose === 'function') {
                    (engineRef.current as any).dispose();
                }
            }
        };
    }, []);

    // Generate blob on mount
    useEffect(() => {
        const blob = generateClickBlob();
        const url = URL.createObjectURL(blob);
        setClickBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, []);

    // Sync Offset
    useEffect(() => {
        const safeOffset = Math.max(-500, Math.min(500, offset));
        if (engineRef.current) {
            engineRef.current.setOffset(safeOffset);
        }
    }, [offset]);

    // Handle Playback & Looping
    useEffect(() => {
        if (!engineRef.current || !clickBlobUrl) return;
        const engine = engineRef.current;

        const handleEnded = () => {
            // If we are still supposed to be playing, loop it
            // We can check isPlaying from closure state?
            // Or simpler: just restart. If we stopped, we would have called engine.stop() in cleanup.
            // But careful about race conditions.
            // The effect re-runs if isPlaying changes.
            // So if this closure is active, isPlaying is likely true (unless it changed and cleanup hasn't run yet? No, cleanup runs first).
            // However, `isPlaying` in this closure is constant.
            if (isPlaying) {
                engine.seek(0);
                engine.play();
            }
        };

        const cleanupEnded = engine.onEnded(handleEnded);

        if (isPlaying) {
            engine.loadFile({ instrumental: clickBlobUrl, vocal: null }).then(() => {
                if (isPlaying) engine.play();
            });
        } else {
            engine.stop();
        }

        return () => {
            cleanupEnded();
            engine.stop();
        };
    }, [isPlaying, clickBlobUrl]);

    // Visual Beat Animation
    useEffect(() => {
        if (!isPlaying) return;

        const updateBeat = () => {
            if (!isPlaying || !engineRef.current) return;

            const time = engineRef.current.getCurrentTime();
            // Beat every 0.5s
            const mod = time % 0.5;
            const isBeat = mod < 0.1;

            if (beatRef.current) {
                beatRef.current.style.opacity = isBeat ? '1' : '0.2';
                beatRef.current.style.transform = isBeat ? 'scale(1.2)' : 'scale(1)';
            }
            loopRef.current = requestAnimationFrame(updateBeat);
        };

        loopRef.current = requestAnimationFrame(updateBeat);

        return () => {
            if (loopRef.current) cancelAnimationFrame(loopRef.current);
        };
    }, [isPlaying]);


    const handleSave = () => {
        saveAudioOffset(streamDeviceId, headphoneDeviceId, offset);
        // Apply to main application engine
        audioEngine.setOffset(offset);
        onOffsetChange(offset);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const clamp = (v: number) => Math.max(-500, Math.min(500, v));

    return (
        <div
            onClick={handleCancel}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '600px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '12px',
                    padding: '32px',
                    color: '#fff',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>雙輸出同步校準</h2>
                    <div
                        ref={beatRef}
                        style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#0f0',
                            opacity: 0.2,
                            transition: 'transform 0.05s'
                        }}
                    />
                </div>

                {/* Instructions */}
                <div style={{
                    backgroundColor: '#1f1f1f',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#ccc',
                    maxHeight: '180px',
                    overflowY: 'auto'
                }}>
                    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>【目的】</div>
                    <div style={{ marginBottom: '8px' }}>
                        調整延遲，讓「串流監聽（Loopback）」與「耳機直接監聽」的 Click 聲在時間上完全重疊。
                    </div>

                    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>【準備】</div>
                    <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                        <li><b>開啟 OBS 監聽：</b>在 OBS 混音器點擊齒輪 <span style={{ fontFamily: 'Segoe UI Symbol' }}>⚙</span> → 進階音訊屬性 → 將您的音訊來源設為 <b>「僅監聽」或「監聽並輸出」</b>。</li>
                        <li><b>確認取樣率：</b>請查看設定選單中，所選裝置方塊右上角的 <b>Hz 標籤</b>。確保所有裝置與 OBS 設定的取樣率一致（如 48000 Hz）。</li>
                    </ul>

                    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>【操作】</div>
                    <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
                        <li>點擊下方「開始測試」，調整滑桿直到兩個聲音重疊成一個。</li>
                    </ul>
                </div>

                {/* Main Controls */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    gap: '12px',
                    marginTop: '8px'
                }}>
                    {/* Big Display */}
                    <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        fontVariantNumeric: 'tabular-nums',
                        color: offset === 0 ? '#fff' : 'var(--accent-color)',
                        textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                    }}>
                        {offset > 0 ? `+${offset}` : offset} <span style={{ fontSize: '14px', color: '#888' }}>ms</span>
                    </div>

                    {/* Slider Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                        {/* Left Buttons (-10, -1) */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setOffset(clamp(offset - 10))} style={fineTuneBtn}>-10</button>
                            <button onClick={() => setOffset(clamp(offset - 1))} style={fineTuneBtn}>-1</button>
                        </div>

                        {/* Slider Container */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <input
                                type="range"
                                min="-500"
                                max="500"
                                value={offset}
                                onChange={(e) => setOffset(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />

                            {/* Labels below slider */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: '12px',
                                fontSize: '12px',
                                color: '#aaa',
                                fontWeight: 'bold'
                            }}>
                                <span>← 串流延遲 (Stream)</span>
                                <span>耳機延遲 (Monitor) →</span>
                            </div>
                        </div>

                        {/* Right Buttons (+1, +10) */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setOffset(clamp(offset + 1))} style={fineTuneBtn}>+1</button>
                            <button onClick={() => setOffset(clamp(offset + 10))} style={fineTuneBtn}>+10</button>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    width: '100%',
                    marginTop: 'auto',
                    borderTop: '1px solid #333',
                    paddingTop: '24px'
                }}>
                    {/* Left: Cancel */}
                    <div style={{ justifySelf: 'start' }}>
                        <button
                            onClick={handleCancel}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '6px',
                                border: '1px solid #444',
                                backgroundColor: 'transparent',
                                color: '#ddd',
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                    </div>

                    {/* Center: Start/Stop */}
                    <div style={{ justifySelf: 'center' }}>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            style={{
                                padding: '12px 40px',
                                borderRadius: '30px',
                                border: 'none',
                                backgroundColor: isPlaying ? '#cc3333' : 'var(--accent-color)',
                                color: '#fff',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                        >
                            {isPlaying ? '停止測試' : '開始測試'}
                        </button>
                    </div>

                    {/* Right: Save */}
                    <div style={{ justifySelf: 'end' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#fff',
                                color: '#000',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            儲存並套用
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const fineTuneBtn = {
    padding: '8px 12px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px'
};

export default CalibrationModal;
