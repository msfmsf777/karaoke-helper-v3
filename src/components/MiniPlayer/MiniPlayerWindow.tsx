import React, { useEffect, useState, useRef } from 'react';
import LogoIcon from '../../assets/images/logo.png';
import PlayIcon from '../../assets/icons/play.svg';
import PauseIcon from '../../assets/icons/pause.svg';
import NextIcon from '../../assets/icons/next.svg';
import PrevIcon from '../../assets/icons/prev.svg';
import SpeedIcon from '../../assets/icons/speed.svg';
import PitchIcon from '../../assets/icons/pitch.svg';
import VolumeHighIcon from '../../assets/icons/volume_high.svg';
import VolumeLowIcon from '../../assets/icons/volume_low.svg';
import VolumeMuteIcon from '../../assets/icons/volume_mute.svg';
import PlaylistIcon from '../../assets/icons/playlist.svg';
import ScrollingText from '../ScrollingText';
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

const MergedVolumeControl: React.FC<{
    instVol: number;
    instMuted: boolean;
    vocalVol: number;
    vocalMuted: boolean;
    onInstChange: (v: number) => void;
    onVocalChange: (v: number) => void;
    onToggleInstMute: () => void;
    onToggleVocalMute: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    forceHover?: boolean;
}> = (props) => {
    const [hover, setHover] = useState(false);
    const show = hover || props.forceHover;

    // Logic for Restore-on-Unmute (Mem)
    const [lastInstVol, setLastInstVol] = useState(props.instVol > 0 ? props.instVol : 0.5);
    const [lastVocalVol, setLastVocalVol] = useState(props.vocalVol > 0 ? props.vocalVol : 0.5);

    // Sync last volumes when regular volume changes (and is not muted/zero)
    useEffect(() => { if (props.instVol > 0) setLastInstVol(props.instVol); }, [props.instVol]);
    useEffect(() => { if (props.vocalVol > 0) setLastVocalVol(props.vocalVol); }, [props.vocalVol]);

    // Manual Input Handling (Declared at TOP LEVEL to fix scoping error)
    const [localInst, setLocalInst] = useState<number | null>(null);
    const [localVocal, setLocalVocal] = useState<number | null>(null);

    // Throttled IPC Update Refs
    const instThrottler = useRef<number | null>(null);
    const vocalThrottler = useRef<number | null>(null);

    // Optimized Change Handlers
    const handleInstChange = (newVal: number) => {
        setLocalInst(newVal);
        if (instThrottler.current) cancelAnimationFrame(instThrottler.current);
        instThrottler.current = requestAnimationFrame(() => {
            props.onInstChange(newVal);
            instThrottler.current = null;
        });
    };

    const handleVocalChange = (newVal: number) => {
        setLocalVocal(newVal);
        if (vocalThrottler.current) cancelAnimationFrame(vocalThrottler.current);
        vocalThrottler.current = requestAnimationFrame(() => {
            props.onVocalChange(newVal);
            vocalThrottler.current = null;
        });
    };

    const toggleInst = () => {
        // If currently muted (prop) OR volume is 0, restore last > 0
        if (props.instMuted || (localInst ?? props.instVol) === 0) {
            // Unmute: Set volume to last known good volume
            handleInstChange(lastInstVol > 0 ? lastInstVol : 0.5);
            // Also ensure backend mute flag is off if it exists
            if (props.instMuted) props.onToggleInstMute();
        } else {
            // Mute: Set volume to 0 AND toggle mute flag
            handleInstChange(0);
            if (!props.instMuted) props.onToggleInstMute();
        }
    };

    const toggleVocal = () => {
        if (props.vocalMuted || (localVocal ?? props.vocalVol) === 0) {
            handleVocalChange(lastVocalVol > 0 ? lastVocalVol : 0.5);
            if (props.vocalMuted) props.onToggleVocalMute();
        } else {
            handleVocalChange(0);
            if (!props.vocalMuted) props.onToggleVocalMute();
        }
    };

    // Helper for input text
    const handleTextInput = (val: string, handler: (v: number) => void) => {
        const num = parseInt(val);
        if (!isNaN(num)) {
            const clamped = Math.min(100, Math.max(0, num));
            handler(clamped / 100);
        }
    };

    const sliderInstVal = localInst ?? props.instVol;
    const sliderVocalVal = localVocal ?? props.vocalVol;

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => { setHover(false); setLocalInst(null); setLocalVocal(null); }} // Clear overrides on leave
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                // @ts-ignore
                WebkitAppRegion: 'no-drag'
            }}
        >
            {/* Main Icon */}
            <div style={{
                position: 'absolute',
                opacity: show ? 0 : 1,
                transform: show ? 'scale(0.8)' : 'scale(1)',
                transition: 'all 0.3s ease',
                pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <img src={(props.instMuted || sliderInstVal === 0) ? VolumeMuteIcon : (sliderInstVal < 0.5 ? VolumeLowIcon : VolumeHighIcon)} alt="Volume" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
            </div>

            {/* Split Controls */}
            <div
                id="mini-player-volume-popup"
                style={{
                    position: 'absolute',
                    bottom: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%) scale(0.9)',
                    transformOrigin: 'bottom center',
                    display: 'flex',
                    gap: '8px',
                    pointerEvents: show ? 'auto' : 'none',
                    opacity: show ? 1 : 0,
                    zIndex: 200,
                    backgroundColor: 'rgba(34, 34, 34, 0.95)',
                    backdropFilter: 'blur(8px)',
                    padding: '12px 10px 4px 10px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transition: 'opacity 0.2s ease, transform 0.2s ease'
                }}>
                {/* Instrumental */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: show ? 'translateX(0)' : 'translateX(6px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '4px', height: show ? 'auto' : 0, overflow: 'hidden', paddingBottom: '4px' }}>
                        <input
                            value={String(Math.round(sliderInstVal * 100))}
                            onChange={(e) => handleTextInput(e.target.value, handleInstChange)}
                            style={{
                                width: '28px', background: 'transparent', border: 'none', color: '#fff',
                                textAlign: 'center', fontSize: '10px', marginBottom: '2px', outline: 'none',
                                opacity: 0.8
                            }}
                        />
                        <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '20px' }}>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={sliderInstVal}
                                onInput={(e) => handleInstChange(parseFloat((e.target as HTMLInputElement).value))}
                                style={{
                                    WebkitAppearance: 'slider-vertical', width: '4px', height: '100%',
                                    cursor: 'pointer', accentColor: '#4CAF50'
                                }}
                                onPointerDown={props.onDragStart}
                                onPointerUp={props.onDragEnd}
                            />
                        </div>
                    </div>
                    <button onClick={toggleInst} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                        <img src={(props.instMuted || sliderInstVal === 0) ? VolumeMuteIcon : (sliderInstVal < 0.5 ? VolumeLowIcon : VolumeHighIcon)} style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                    </button>
                    <span style={{ fontSize: '10px', color: '#aaa', lineHeight: '1' }}>伴奏</span>
                </div>

                {/* Vocal */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: show ? 'translateX(0)' : 'translateX(-6px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '4px', height: show ? 'auto' : 0, overflow: 'hidden', paddingBottom: '4px' }}>
                        <input
                            value={String(Math.round(sliderVocalVal * 100))}
                            onChange={(e) => handleTextInput(e.target.value, handleVocalChange)}
                            style={{
                                width: '28px', background: 'transparent', border: 'none', color: '#fff',
                                textAlign: 'center', fontSize: '10px', marginBottom: '2px', outline: 'none',
                                opacity: 0.8
                            }}
                        />
                        <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '20px' }}>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={sliderVocalVal}
                                onInput={(e) => handleVocalChange(parseFloat((e.target as HTMLInputElement).value))}
                                style={{
                                    WebkitAppearance: 'slider-vertical', width: '4px', height: '100%',
                                    cursor: 'pointer', accentColor: '#4CAF50'
                                }}
                                onPointerDown={props.onDragStart}
                                onPointerUp={props.onDragEnd}
                            />
                        </div>
                    </div>
                    <button onClick={toggleVocal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                        <img src={(props.vocalMuted || sliderVocalVal === 0) ? VolumeMuteIcon : (sliderVocalVal < 0.5 ? VolumeLowIcon : VolumeHighIcon)} style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                    </button>
                    <span style={{ fontSize: '10px', color: '#aaa', lineHeight: '1' }}>人聲</span>
                </div>
            </div>
        </div>
    );
};

const MiniPlaybackControl: React.FC<{
    title: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatLabel: (val: number) => string;
    onChange: (val: number) => void;
    onReset: () => void;
}> = ({ title, value, min, max, step, formatLabel, onChange, onReset }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        let initialEditVal = value;
        if (title === '變速') initialEditVal = Math.round(value * 100);
        setEditValue(initialEditVal.toString());
        setIsEditing(true);
    };

    const handleCommitEdit = () => {
        let num = parseFloat(editValue);
        if (!isNaN(num)) {
            if (title === '變速') num = num / 100;
            const clamped = Math.max(min, Math.min(num, max));
            onChange(clamped);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCommitEdit();
        else if (e.key === 'Escape') setIsEditing(false);
    };

    return (
        <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            width: '180px', // Scaled down from 200px (increased slightly from 160px to fit buttons)
            backgroundColor: '#2b2b2b',
            borderRadius: '8px',
            padding: '8px', // Scaled down padding
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
        }} onMouseDown={(e) => e.stopPropagation()}>
            {/* Top Row: Title, Value/Input, Reset */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#aaa' }}>{title}</span>
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCommitEdit}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '40px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '11px',
                            textAlign: 'center',
                            padding: '1px',
                        }}
                    />
                ) : (
                    <span
                        onClick={handleStartEdit}
                        style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderBottom: '1px dashed #666' }}
                        title="Click to edit"
                    >
                        {formatLabel(value)}
                    </span>
                )}
                <button onClick={onReset} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }} title="Reset">
                    ↺
                </button>
            </div>

            {/* Middle Row: Controls ( - Slider + ) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                    onClick={() => onChange(Math.max(min, value - step))}
                    style={{ background: '#333', border: 'none', borderRadius: '4px', color: '#fff', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    -
                </button>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-color, #1db954)', height: '4px', minWidth: 0 }}
                />
                <button
                    onClick={() => onChange(Math.min(max, value + step))}
                    style={{ background: '#333', border: 'none', borderRadius: '4px', color: '#fff', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    +
                </button>
            </div>
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
        queue: [] as { id: string; title: string; artist: string }[],
        currentIndex: 0,
        isFavorite: false,
        displayTitle: '',
        displayArtist: ''
    });
    const [hovered, setHovered] = useState(false);
    const [isVolumeHovered, setIsVolumeHovered] = useState(false);
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const [showSpeed, setShowSpeed] = useState(false);
    const [showPitch, setShowPitch] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const speedContainerRef = useRef<HTMLDivElement>(null);
    const pitchContainerRef = useRef<HTMLDivElement>(null);

    // Close popups when volume is hovered
    useEffect(() => {
        if (isVolumeHovered) {
            setShowSpeed(false);
            setShowPitch(false);
        }
    }, [isVolumeHovered]);

    // Close popups when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showSpeed && speedContainerRef.current && !speedContainerRef.current.contains(event.target as Node)) {
                setShowSpeed(false);
            }
            if (showPitch && pitchContainerRef.current && !pitchContainerRef.current.contains(event.target as Node)) {
                setShowPitch(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSpeed, showPitch]);

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

        // Initialize: Ignore mouse events on transparent background (click-through)
        // But forward them so we can detect entry into visible elements if possible,
        // OR rely on the fact that we set it to forward: true in main.ts initially.
        window.khelper?.miniPlayer.setIgnoreMouseEvents?.(true, { forward: true });

        // Request initial state
        window.khelper?.miniPlayer.sendCommand('refresh');

        return () => {
            removeListener?.();
        };
    }, []);

    // State for tracking interaction mode to avoid IPC flooding
    const interactionRef = useRef({ ignore: true, hovered: false, isDragging: false });

    useEffect(() => {
        // Interaction Polling
        const handleCursorPoll = (pos: { x: number, y: number }) => {
            let newIgnore = true;
            let newHover = false;
            let newVolumeHover = false;

            if (pos.x >= 0 && pos.y >= 0) {
                const elements = document.elementsFromPoint(pos.x, pos.y);
                const inPlaylist = elements.some(el => el.id === 'mini-player-playlist' || el.closest('#mini-player-playlist'));
                const inDisk = elements.some(el => el.id === 'mini-player-disk' || el.closest('#mini-player-disk'));
                const inPill = elements.some(el => el.id === 'mini-player-pill' || el.closest('#mini-player-pill'));
                const inVolumePopup = elements.some(el => el.id === 'mini-player-volume-popup' || el.closest('#mini-player-volume-popup'));

                newVolumeHover = inVolumePopup;

                const isVisible = inDisk || inPill || inVolumePopup;

                if (isVisible) {
                    newIgnore = false;
                    if (inPlaylist) {
                        newHover = false;
                    } else {
                        newHover = true; // Control visibility based on generic hover
                    }
                }
            }

            if (newIgnore !== interactionRef.current.ignore) {
                window.khelper?.miniPlayer.setIgnoreMouseEvents?.(newIgnore, { forward: true });
                interactionRef.current.ignore = newIgnore;
            }

            if (newHover !== interactionRef.current.hovered) {
                setHovered(newHover);
                interactionRef.current.hovered = newHover;
                if (!newHover && !interactionRef.current.isDragging) {
                    // Only close if not dragging
                    setShowSpeed(false);
                    setShowPitch(false);
                }
            }

            // Sync volume hover state purely for popup visibility (avoid flickers)
            setIsVolumeHovered(prev => prev !== newVolumeHover ? newVolumeHover : prev);
        };

        const cleanup = window.khelper?.miniPlayer?.onCursorPoll?.(handleCursorPoll);
        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const onDragStart = () => {
        interactionRef.current.isDragging = true;
        setIsDraggingVolume(true);
    };
    const onDragEnd = () => {
        interactionRef.current.isDragging = false;
        setIsDraggingVolume(false);
    };


    // Dynamic Window Resizing based on Queue State
    useEffect(() => {
        if (showQueue) {
            window.khelper?.miniPlayer?.resize(420, 420); // Taller window to robustly handle popup overlap
        } else {
            window.khelper?.miniPlayer?.resize(420, 220); // Base height increased for popup headroom
        }
    }, [showQueue]);

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
                alignItems: 'flex-start',
                justifyContent: 'center',
                fontFamily: '"Outfit", sans-serif',
                userSelect: 'none',
                overflow: 'hidden',
                backgroundColor: 'transparent',
                // @ts-ignore
                WebkitAppRegion: 'no-drag' // Global no-drag
            }}
        >
            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    width: 'auto',
                    maxWidth: '90vw',
                    paddingTop: '20px', // Compensate for top alignment & shadow
                    paddingLeft: '20px', // Safety padding
                }}>
                {/* Floating Circle Knob (Left) */}
                <div
                    id="mini-player-disk"
                    onClick={() => window.khelper?.miniPlayer?.sendCommand('toggleMainWindow')}
                    style={{
                        position: 'relative',
                        zIndex: 50,
                        width: `${circleSize}px`,
                        height: `${circleSize}px`,
                        flexShrink: 0,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(20,20,20,0.95)',
                        boxShadow: '4px 0 20px rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        // Embossed Effect: Increased overlap & Lift
                        marginTop: '68px', // Move up slightly
                        marginRight: '-84px', // Deep overlap to "emboss"
                        // @ts-ignore
                        WebkitAppRegion: 'no-drag', // Entire disk is clickable, NOT draggable
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
                    <div
                        style={{
                            width: `${circleSize - 20}px`, height: `${circleSize - 20}px`, borderRadius: '50%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}
                    >
                        {hovered ? (
                            <img src={LogoIcon} alt="Logo" style={{ width: '40px', height: '40px', opacity: 0.8 }} />
                        ) : (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color, #00A3FF)' }}>
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Pill Container (Right) */}
                <div
                    id="mini-player-pill"
                    style={{
                        position: 'relative',
                        zIndex: 1, // Ensure it is below Disk (50)
                        marginLeft: '0px',
                        // Align Vertically:
                        // Circle is at Top (0px local + 20px padding). Height 96. Center at 48.
                        // Pill Height is 60 (Top Row). Center at 30.
                        // To align centers: Pill Top needs to be at 48 - 30 = 18px relative to Circle Top.
                        marginTop: '112px',

                        minHeight: '60px',
                        // paddingLeft moved to children for flexible layout
                        paddingRight: '20px',
                        minWidth: '320px',
                        width: 'auto', // Allow dynamic width
                        backgroundColor: 'rgba(20, 20, 20, 0.95)',
                        borderRadius: showQueue ? '30px 30px 16px 16px' : '30px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start', // Top align content
                        // @ts-ignore
                        WebkitAppRegion: 'drag',
                        transition: 'border-radius 0.2s'
                    }}>

                    {/* Close Button */}
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '18px',
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

                    {/* Top Row: Info + Controls */}
                    <div
                        onMouseEnter={() => setHovered(true)} // Explicitly ensure controls show here
                        style={{
                            height: '60px',
                            width: '100%',
                            paddingLeft: '84px', // Compensate for Disk overlap HERE
                            paddingRight: '36px', // Standard padding for controls right side
                            position: 'relative', // Scope absolute children (Controls) to this row!
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                        {/* Song Info - ABOSLUTE CENTERED for perfect geometric alignment */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '60px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: hovered ? 0 : 1,
                            transition: 'opacity 0.2s',
                            pointerEvents: 'none', // Let touches pass through to row if needed
                            zIndex: 0,
                            transform: 'translateX(-15px)' // Direct Nudge Left
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <ScrollingText
                                    text={state.displayTitle || '未播放'}
                                    style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '2px', textAlign: 'center' }}
                                />
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                                    {state.displayArtist || '迷你播放器'}
                                </div>
                            </div>
                        </div>

                        {/* Controls (Visible on Hover) */}
                        {hovered && (
                            <div style={{
                                position: 'absolute',
                                left: '84px', // Match paddingLeft of row
                                right: '36px', // Avoid close button
                                top: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start', // Align left to reduce gap to disk
                                gap: '4px', // Standardized compact gap
                            }}>
                                {/* Order: Speed, Pitch, Prev, Play, Next, Volumes, Playlist */}

                                {/* Speed & Pitch */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ position: 'relative' }} ref={speedContainerRef}>
                                        <ControlButton
                                            icon={SpeedIcon}
                                            title={`速度: ${state.speed}x`}
                                            onClick={() => { setShowSpeed(!showSpeed); setShowPitch(false); }}
                                            active={showSpeed || state.speed !== 1}
                                        />
                                        {showSpeed && (
                                            <MiniPlaybackControl
                                                title="變速"
                                                value={state.speed}
                                                min={0.5}
                                                max={2.0}
                                                step={0.01}
                                                formatLabel={(val) => `${Math.round(val * 100)}%`}
                                                onChange={(val) => window.khelper?.miniPlayer?.sendCommand('setSpeed', val)}
                                                onReset={() => window.khelper?.miniPlayer?.sendCommand('setSpeed', 1.0)}
                                            />
                                        )}
                                    </div>

                                    <div style={{ position: 'relative' }} ref={pitchContainerRef}>
                                        <ControlButton
                                            icon={PitchIcon}
                                            title={`變調: ${state.pitch}`}
                                            onClick={() => { setShowPitch(!showPitch); setShowSpeed(false); }}
                                            active={showPitch || state.pitch !== 0}
                                        />
                                        {showPitch && (
                                            <MiniPlaybackControl
                                                title="變調"
                                                value={state.pitch}
                                                min={-12}
                                                max={12}
                                                step={1}
                                                formatLabel={(val) => val > 0 ? `+${val}` : `${val}`}
                                                onChange={(val) => window.khelper?.miniPlayer?.sendCommand('setPitch', val)}
                                                onReset={() => window.khelper?.miniPlayer?.sendCommand('setPitch', 0)}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Transport: Prev, Play, Next */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ControlButton icon={PrevIcon} onClick={() => window.khelper?.miniPlayer?.sendCommand('prev')} title="上一首" />
                                    <button
                                        onClick={() => window.khelper?.miniPlayer?.sendCommand('playPause')}
                                        style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            backgroundColor: '#fff', border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(255,255,255,0.2)',
                                            // @ts-ignore
                                            WebkitAppRegion: 'no-drag'
                                        }}
                                    >
                                        <img src={state.isPlaying ? PauseIcon : PlayIcon} style={{ width: '12px', height: '12px', filter: 'brightness(0)' }} />
                                    </button>
                                    <ControlButton icon={NextIcon} onClick={() => window.khelper?.miniPlayer?.sendCommand('next')} title="下一首" />
                                </div>

                                {/* Volumes (Merged) */}
                                <MergedVolumeControl
                                    instVol={state.volume.instrumental}
                                    instMuted={state.volume.instrumentalMuted}
                                    vocalVol={state.volume.vocal}
                                    vocalMuted={state.volume.vocalMuted}
                                    onInstChange={(v) => window.khelper?.miniPlayer?.sendCommand('setInstrumentalVolume', v)}
                                    onVocalChange={(v) => window.khelper?.miniPlayer?.sendCommand('setVocalVolume', v)}
                                    onToggleInstMute={() => window.khelper?.miniPlayer?.sendCommand('toggleInstrumentalMute')}
                                    onToggleVocalMute={() => window.khelper?.miniPlayer?.sendCommand('toggleVocalMute')}
                                    onDragStart={onDragStart}
                                    onDragEnd={onDragEnd}
                                    forceHover={isVolumeHovered || isDraggingVolume}
                                />

                                {/* Playlist */}
                                <ControlButton
                                    icon={PlaylistIcon}
                                    onClick={() => setShowQueue(!showQueue)}
                                    title="播放清單"
                                    active={showQueue}
                                />
                            </div>
                        )}
                    </div>

                    {/* Playlist (Bottom Row) */}
                    {showQueue && (
                        <div
                            id="mini-player-playlist"
                            style={{
                                height: '180px',
                                overflowY: 'auto',
                                padding: '10px',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '0 0 16px 16px',
                                boxShadow: 'inset 0 10px 10px -10px rgba(0,0,0,0.5)',
                                // @ts-ignore
                                WebkitAppRegion: 'no-drag'
                            }}
                        >
                            {state.queue.length === 0 ? (
                                <div style={{ color: '#888', textAlign: 'center', fontSize: '12px', paddingTop: '20px' }}>
                                    空空如也
                                </div>
                            ) : (
                                state.queue.map((item, idx) => {
                                    const isCurrent = idx === state.currentIndex;
                                    return (
                                        <div
                                            key={item.id + idx}
                                            onClick={() => window.khelper?.miniPlayer?.sendCommand('playQueueItem', idx)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '6px 8px', borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                backgroundColor: isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                marginBottom: '2px'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                                                const rmBtn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                                if (rmBtn) rmBtn.style.opacity = '1';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'
                                                const rmBtn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                                if (rmBtn) rmBtn.style.opacity = '0';
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    color: isCurrent ? 'var(--accent-color, #646cff)' : '#eee',
                                                    fontWeight: isCurrent ? 600 : 400,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>{item.title}</div>
                                                <div style={{ color: '#888', fontSize: '10px', marginTop: '1px' }}>{item.artist || 'Unknown'}</div>
                                            </div>
                                            <button
                                                className="remove-btn"
                                                onClick={(e) => { e.stopPropagation(); window.khelper?.miniPlayer?.sendCommand('removeFromQueue', idx); }}
                                                style={{
                                                    background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                                                    fontSize: '16px', opacity: 0, transition: 'opacity 0.2s', padding: '4px'
                                                }}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
