import React, { useEffect, useState } from 'react';
import { localPathToFileUrl } from '../utils/localFileUrl';

interface ArtworkTileProps {
    thumbnailPath?: string;
    size: number;
    title?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    overlay?: React.ReactNode;
    overlayVisible?: boolean;
    dimmed?: boolean;
    badge?: React.ReactNode;
    placeholder?: React.ReactNode;
    style?: React.CSSProperties;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const MusicNote = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);

const ArtworkTile: React.FC<ArtworkTileProps> = ({
    thumbnailPath,
    size,
    title,
    onClick,
    overlay,
    overlayVisible,
    dimmed,
    badge,
    placeholder,
    style,
    onMouseEnter,
    onMouseLeave,
}) => {
    const [failed, setFailed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const src = failed ? undefined : localPathToFileUrl(thumbnailPath);
    const showOverlay = overlayVisible ?? isHovered;
    const shouldDim = dimmed ?? showOverlay;

    useEffect(() => {
        setFailed(false);
    }, [thumbnailPath]);

    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onDoubleClick={(event) => event.stopPropagation()}
            onMouseEnter={() => {
                setIsHovered(true);
                onMouseEnter?.();
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                onMouseLeave?.();
            }}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#2c2c2c',
                color: '#cfcfcf',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onClick ? 'pointer' : 'default',
                flexShrink: 0,
                ...style,
            }}
        >
            {src ? (
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    onError={() => setFailed(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        opacity: shouldDim ? 0.42 : 1,
                        transition: 'opacity 0.12s ease',
                    }}
                />
            ) : (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: shouldDim ? 0.42 : 1,
                        transition: 'opacity 0.12s ease',
                    }}
                >
                    {placeholder || <MusicNote />}
                </div>
            )}

            {showOverlay && overlay && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        background: src ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.12)',
                    }}
                >
                    {overlay}
                </div>
            )}

            {badge}
        </button>
    );
};

export default ArtworkTile;
