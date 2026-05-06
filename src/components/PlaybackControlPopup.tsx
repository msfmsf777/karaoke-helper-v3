import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FitText from './FitText';

interface PlaybackControlPopupProps {
    kind: 'speed' | 'pitch';
    title: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatLabel: (val: number) => string;
    onChange: (val: number) => void;
    onReset: () => void;
    onClose: () => void;
}

const PlaybackControlPopup: React.FC<PlaybackControlPopupProps> = ({
    kind,
    title,
    value,
    min,
    max,
    step,
    formatLabel,
    onChange,
    onReset,
    onClose,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        // Let users edit the same units they see: percent for speed, semitones for pitch.
        let initialEditVal = value;
        if (kind === 'speed') {
            initialEditVal = Math.round(value * 100);
        }
        setEditValue(initialEditVal.toString());
        setIsEditing(true);
    };

    const handleCommitEdit = () => {
        let num = parseFloat(editValue);
        if (!isNaN(num)) {
            if (kind === 'speed') {
                num = num / 100;
            }
            // Clamp
            const clamped = Math.max(min, Math.min(num, max));
            onChange(clamped);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommitEdit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div
            ref={popupRef}
            style={{
                position: 'absolute',
                bottom: '50px', // Above the button
                left: '50%',
                transform: 'translateX(-50%)',
                width: '200px',
                backgroundColor: '#2b2b2b',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 1000,
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
        >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FitText
                    text={title}
                    baseFontSize={14}
                    minFontSize={10}
                    style={{
                        color: '#aaa',
                        fontWeight: 'bold',
                        lineHeight: 1.1,
                        flex: '1 1 auto',
                        width: 'auto',
                        minWidth: 0,
                        maxWidth: '108px',
                    }}
                />

                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCommitEdit}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '60px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                            textAlign: 'center',
                            padding: '2px',
                        }}
                    />
                ) : (
                    <span
                        onClick={handleStartEdit}
                        style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderBottom: '1px dashed #666',
                        }}
                        title={t('playbackControl.clickToEdit')}
                    >
                        {formatLabel(value)}
                    </span>
                )}

                <button
                    onClick={onReset}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 4px',
                    }}
                    title={t('common.reset')}
                >
                    ↺
                </button>
            </div>

            {/* Second Row: Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    onClick={() => onChange(Math.max(min, value - step))}
                    style={{
                        background: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
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
                    style={{
                        flex: 1,
                        accentColor: 'var(--accent-color, #1db954)',
                        height: '4px',
                    }}
                />

                <button
                    onClick={() => onChange(Math.min(max, value + step))}
                    style={{
                        background: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default PlaybackControlPopup;
