import React, { useEffect, useState, useRef } from 'react';
import LogoIcon from '../../assets/images/logo.png';
import PlayIcon from '../../assets/icons/play.svg';
import PauseIcon from '../../assets/icons/pause.svg';
import NextIcon from '../../assets/icons/next.svg';
import PrevIcon from '../../assets/icons/prev.svg';
import SpeedIcon from '../../assets/icons/speed.svg';
import PitchIcon from '../../assets/icons/pitch.svg';
import VolumeHighIcon from '../../assets/icons/volume_high.svg';
import VolumeMuteIcon from '../../assets/icons/volume_mute.svg';
import PlaylistIcon from '../../assets/icons/playlist.svg';
import CloseIcon from '../../assets/icons/cancel.svg';

interface ControlProps {
    icon: string;
    onClick: () => void;
    title?: string;
    active?: boolean;
}

const ControlButton: React.FC<ControlProps> = ({ icon, onClick, title, active }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: active ? 1 : 0.7,
            transition: 'opacity 0.2s',
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = active ? '1' : '0.7'}
    >
        <img src={icon} alt={title} style={{ width: '20px', height: '20px', filter: active ? 'brightness(1.5)' : 'none' }} />
    </button>
);

const VolumeSlider: React.FC<{
    value: number;
    onChange: (val: number) => void;
    icon: string;
    muted: boolean;
    onToggleMute: () => void;
    title: string;
}> = ({ value, onChange, icon, muted, onToggleMute, title }) => {
    const [hover, setHover] = useState(false);

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex', alignItems: 'center', position: 'relative', // @ts-ignore
                WebkitAppRegion: 'no-drag'
            }}
        >
            <button
                onClick={onToggleMute}
                title={title}
                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}
            >
                <img src={muted ? VolumeMuteIcon : icon} alt="Volume" style={{ width: '18px', height: '18px' }} />
            </button>

            {/* Popover Slider */}
            {hover && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#282828',
                    padding: '8px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 100,
                    width: '30px',
                    height: '100px'
                }}>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        style={{
                            WebkitAppearance: 'slider-vertical', /* WebKit */
                            width: '4px',
                            height: '80px',
                            cursor: 'pointer'
                        }}
                    />
                    <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'center' }}>{Math.round(value * 100)}</div>
                </div>
            )}
        </div>
    );
};


export default function MiniPlayerWindow() {
    const [state, setState] = useState({
        currentTrack: null as { title: string; artist: string; duration: number } | null,
        isPlaying: false,
        currentTime: 0,
        volume: { instrumental: 1, vocal: 1, instrumentalMuted: false, vocalMuted: false },
        speed: 1,
        pitch: 0,
        queue: [] as { id: string; title: string }[]
    });
    const [hovered, setHovered] = useState(false);
    const [showSpeed, setShowSpeed] = useState(false);
    const [showPitch, setShowPitch] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Add generous padding to width to ensure no shadows/borders are cut off
                const width = entry.contentRect.width + 100;
                // Height is usually fixed 110 but let's dynamic it if needed, or keep fixed
                // The pill + shadows might need more space.
                // Current window height is 110 in main.ts
                window.khelper?.miniPlayer.resize(width, 140); // 140 to be safe for shadows
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const removeListener = window.khelper?.miniPlayer.onStateUpdate((newState) => {
            setState(newState);
        });

        // Fix for hover: Use IPC mouse polling instead of reliance on DOM events
        // which are often swallowed by draggable regions.
        const removeMousePresence = window.khelper?.miniPlayer.onMousePresence?.((isOver) => {
            setHovered(isOver);
            // Also close menus if leaving
            if (!isOver) {
                setShowSpeed(false);
                setShowPitch(false);
                setShowQueue(false);
            }
        });

        // Request initial state
        window.khelper?.miniPlayer.sendCommand('refresh');

        return () => {
            removeListener?.();
            removeMousePresence?.();
        };
    }, []);

    const progress = state.currentTrack?.duration ? state.currentTime / state.currentTrack.duration : 0;

    // Progress Ring
    const radius = 44; // Enlarged radius
    const strokeWidth = 3; // Thinner border
    const circleSize = (radius * 2) + strokeWidth + 4; // Dynamic size based on radius
    const center = circleSize / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Outfit", sans-serif',
                userSelect: 'none',
                overflow: 'hidden',
                backgroundColor: 'transparent'
            }}
        // Hover handled by IPC polling now for robustness
        >
            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 'auto', // Allow dynamic width
                    maxWidth: '90vw'
                }}>
                {/* Floating Circle Knob (Left) - Z-Index higher to sit on top of pill */}
                <div
                    onClick={() => window.khelper?.miniPlayer?.sendCommand('toggleMainWindow')}
                    style={{
                        position: 'relative',
                        zIndex: 10,
                        width: `${circleSize}px`, // 96px approx
                        height: `${circleSize}px`,
                        flexShrink: 0,
                        borderRadius: '50%',
                        // removed background #111 to "remove outer black one", now relies on inner content bg or transparent
                        backgroundColor: 'rgba(20,20,20,0.95)', // Match pill bg instead of black
                        boxShadow: '4px 0 20px rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        // @ts-ignore
                        WebkitAppRegion: 'no-drag',
                    }}
                >
                    {/* Progress SVG */}
                    <svg width={circleSize} height={circleSize} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                        {/* Track - Thinner */}
                        <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
                        {/* Progress */}
                        <circle
                            cx={center} cy={center} r={radius} stroke="var(--primary-color, #00A3FF)" strokeWidth={strokeWidth} fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                        />
                    </svg>

                    {/* Content */}
                    <div style={{ width: `${circleSize - 20}px`, height: `${circleSize - 20}px`, borderRadius: '50%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {hovered ? (
                            <img src={LogoIcon} alt="Logo" style={{ width: '40px', height: '40px', opacity: 0.8 }} />
                        ) : (
                            <div style={{ color: 'var(--primary-color)', fontSize: '24px' }}>♫</div>
                        )}
                    </div>
                </div>

                {/* Pill Container (Right) */}
                <div style={{
                    position: 'relative',
                    marginLeft: '-48px', // Increase overlap slightly due to larger circle
                    height: '60px',
                    paddingLeft: '60px', // Adjusted space
                    paddingRight: '20px',
                    minWidth: '320px', // Reduced to tighten spacing
                    width: 'auto', // Dynamic width expands if needed
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    borderRadius: '0 30px 30px 0', // rounded right only effectively
                    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: 'none', // Hide left border where it merges
                    display: 'flex',
                    alignItems: 'center',
                    // @ts-ignore
                    WebkitAppRegion: 'drag',
                }}>

                    {/* Close Button */}
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '12px',
                        zIndex: 20,
                        opacity: hovered ? 1 : 0,
                        transition: 'opacity 0.2s',
                        // @ts-ignore
                        WebkitAppRegion: 'no-drag'
                    }}>
                        <button
                            onClick={() => window.khelper?.miniPlayer?.toggle()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                        >
                            <img src={CloseIcon} alt="Close" style={{ width: '12px', height: '12px', filter: 'brightness(0) invert(1)' }} />
                        </button>
                    </div>

                    {!hovered ? (
                        // Idle View - Centered Text (Visually)
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            transform: 'translateX(-15px)' // Adjusted to center visually including right corner
                        }}>
                            <div style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#fff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%'
                            }}>
                                {state.currentTrack?.title || '未在播放'}
                            </div>
                            <div style={{
                                fontSize: '12px',
                                color: '#aaa',
                                marginTop: '2px'
                            }}>
                                {state.currentTrack?.artist || 'Ready to Sing'}
                            </div>
                        </div>
                    ) : (
                        // Hovered Controls View
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {/* Speed */}
                            <div style={{ position: 'relative' }}>
                                <ControlButton
                                    icon={SpeedIcon}
                                    onClick={() => setShowSpeed(!showSpeed)}
                                    title={`速度：${Math.round(state.speed * 100)}%`}
                                    active={state.speed !== 1}
                                />
                                {showSpeed && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', left: '-10px',
                                        backgroundColor: '#282828', padding: '8px', borderRadius: '4px',
                                        display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        // @ts-ignore
                                        WebkitAppRegion: 'no-drag'
                                    }}>
                                        <button onClick={() => window.khelper?.miniPlayer?.sendCommand('setSpeed', 1)} style={{ fontSize: '10px', padding: '2px 4px', background: '#444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '2px' }}>重置</button>
                                        <input type="range" min="0.5" max="1.5" step="0.05" value={state.speed}
                                            onChange={(e) => window.khelper?.miniPlayer?.sendCommand('setSpeed', parseFloat(e.target.value))}
                                            style={{ width: '80px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '10px', width: '30px' }}>{Math.round(state.speed * 100)}%</span>
                                    </div>
                                )}
                            </div>

                            {/* Pitch */}
                            <div style={{ position: 'relative' }}>
                                <ControlButton
                                    icon={PitchIcon}
                                    onClick={() => setShowPitch(!showPitch)}
                                    title={`變調：${state.pitch}`}
                                    active={state.pitch !== 0}
                                />
                                {showPitch && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', left: '-10px',
                                        backgroundColor: '#282828', padding: '8px', borderRadius: '4px',
                                        display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        // @ts-ignore
                                        WebkitAppRegion: 'no-drag'
                                    }}>
                                        <button onClick={() => window.khelper?.miniPlayer?.sendCommand('setPitch', 0)} style={{ fontSize: '10px', padding: '2px 4px', background: '#444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '2px' }}>重置</button>
                                        <button onClick={() => window.khelper?.miniPlayer?.sendCommand('setPitch', state.pitch - 1)} style={{ background: 'none', color: '#fff', border: '1px solid #555', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}>-</button>
                                        <span style={{ fontSize: '12px', width: '20px', textAlign: 'center' }}>{state.pitch}</span>
                                        <button onClick={() => window.khelper?.miniPlayer?.sendCommand('setPitch', state.pitch + 1)} style={{ background: 'none', color: '#fff', border: '1px solid #555', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}>+</button>
                                    </div>
                                )}
                            </div>

                            {/* Transport */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ControlButton icon={PrevIcon} onClick={() => window.khelper?.miniPlayer?.sendCommand('prev')} title="上一首" />
                                <button
                                    onClick={() => window.khelper?.miniPlayer?.sendCommand('playPause')}
                                    style={{
                                        background: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(255,255,255,0.2)',
                                        // @ts-ignore
                                        WebkitAppRegion: 'no-drag'
                                    }}
                                >
                                    <img src={state.isPlaying ? PauseIcon : PlayIcon} style={{ width: '16px', height: '16px' }} />
                                </button>
                                <ControlButton icon={NextIcon} onClick={() => window.khelper?.miniPlayer?.sendCommand('next')} title="下一首" />
                            </div>

                            {/* Volumes */}
                            <VolumeSlider
                                value={state.volume.instrumental}
                                onChange={(v) => window.khelper?.miniPlayer?.sendCommand('setInstrumentalVolume', v)}
                                icon={VolumeHighIcon}
                                muted={state.volume.instrumentalMuted}
                                onToggleMute={() => window.khelper?.miniPlayer?.sendCommand('toggleInstrumentalMute')}
                                title={`伴奏：${Math.round(state.volume.instrumental * 100)}%`}
                            />
                            <VolumeSlider
                                value={state.volume.vocal}
                                onChange={(v) => window.khelper?.miniPlayer?.sendCommand('setVocalVolume', v)}
                                icon={VolumeHighIcon}
                                muted={state.volume.vocalMuted}
                                onToggleMute={() => window.khelper?.miniPlayer?.sendCommand('toggleVocalMute')}
                                title={`人聲：${Math.round(state.volume.vocal * 100)}%`}
                            />

                            {/* Queue Toggle */}
                            <div style={{ position: 'relative' }}>
                                <ControlButton
                                    icon={PlaylistIcon}
                                    onClick={() => setShowQueue(!showQueue)}
                                    title="待播清單"
                                />
                                {showQueue && (
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0,
                                        width: '200px', maxHeight: '200px', overflowY: 'auto',
                                        backgroundColor: '#1E1E1E', border: '1px solid #333', borderRadius: '8px',
                                        zIndex: 50, marginTop: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
                                        // @ts-ignore
                                        WebkitAppRegion: 'no-drag'
                                    }}>
                                        {state.queue.map((item, idx) => (
                                            <div key={idx} style={{ padding: '6px 10px', fontSize: '12px', borderBottom: '1px solid #2a2a2a', color: idx === 0 ? 'var(--primary-color)' : '#eee' }}>
                                                <div style={{ fontWeight: '500' }}>{item.title}</div>
                                            </div>
                                        ))}
                                        {state.queue.length === 0 && <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: '#666' }}>無待播歌曲</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
