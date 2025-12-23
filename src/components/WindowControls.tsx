import React from 'react';


interface WindowControlsProps {
    className?: string;
    style?: React.CSSProperties;
    iconColor?: string;
    hoverColor?: string;
    variant?: 'default' | 'stream';
}

const WindowControls: React.FC<WindowControlsProps> = ({
    className,
    style,
    iconColor = '#ccc',
    hoverColor = '#fff',
    variant = 'default'
}) => {
    const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

    const isStream = variant === 'stream';

    const baseButtonStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s, color 0.2s',
        WebkitAppRegion: 'no-drag',
        // Default variant is bigger
        padding: isStream ? '8px 12px' : '12px 16px',
        color: iconColor,
    } as React.CSSProperties;

    const getButtonStyle = (type: 'min' | 'max' | 'close') => {
        const isHovered = hoveredButton === type;

        if (isStream) {
            // Stream variant (original style)
            return {
                ...baseButtonStyle,
                backgroundColor: isHovered
                    ? (type === 'close' ? '#e81123' : 'rgba(255, 255, 255, 0.1)')
                    : 'transparent',
                color: isHovered ? (type === 'close' ? '#fff' : hoverColor) : iconColor,
            };
        } else {
            // Default variant (Main App)
            let color = iconColor;
            if (isHovered) {
                if (type === 'close') color = '#e81123'; // Red for close
                else color = hoverColor; // White/Bright for others
            }

            return {
                ...baseButtonStyle,
                backgroundColor: 'transparent', // No background change
                color: color,
            };
        }
    };

    const [isMaximized, setIsMaximized] = React.useState(false);

    React.useEffect(() => {
        // Initial check
        window.khelper?.windowOps?.isMaximized().then(setIsMaximized);

        // Listeners
        const cleanupMax = window.khelper?.windowOps?.onMaximized(() => setIsMaximized(true));
        const cleanupUnmax = window.khelper?.windowOps?.onUnmaximized(() => setIsMaximized(false));

        return () => {
            cleanupMax?.();
            cleanupUnmax?.();
        };
    }, []);

    const handleMinimize = () => {
        window.khelper?.windowOps?.minimize();
    };

    const handleMaximize = () => {
        window.khelper?.windowOps?.maximize();
    };

    const handleClose = () => {
        window.khelper?.windowOps?.close();
    };

    return (
        <div className={className} style={{ display: 'flex', alignItems: 'center', ...style }}>
            <button
                onClick={handleMinimize}
                title="最小化"
                style={getButtonStyle('min')}
                onMouseEnter={() => setHoveredButton('min')}
                onMouseLeave={() => setHoveredButton(null)}
            >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M1 5h8" />
                </svg>
            </button>
            <button
                onClick={handleMaximize}
                title={isMaximized ? "還原" : "最大化"}
                style={getButtonStyle('max')}
                onMouseEnter={() => setHoveredButton('max')}
                onMouseLeave={() => setHoveredButton(null)}
            >
                {isMaximized ? (
                    // Restore Icon (Custom SVG via mask for currentColor support)
                    // Restore Icon (Inline SVG for reliability)
                    <svg width="18" height="18" viewBox="0 0 36 36" fill="currentColor">
                        <path d="M28,8H14a2,2,0,0,0-2,2v2h2V10H28V20H26v2h2a2,2,0,0,0,2-2V10A2,2,0,0,0,28,8Z" />
                        <path d="M22,14H8a2,2,0,0,0-2,2V26a2,2,0,0,0,2,2H22a2,2,0,0,0,2-2V16A2,2,0,0,0,22,14ZM8,26V16H22V26Z" />
                    </svg>
                ) : (
                    // Maximize Icon (One square)
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
                    </svg>
                )}
            </button>
            <button
                onClick={handleClose}
                title="關閉"
                style={getButtonStyle('close')}
                onMouseEnter={() => setHoveredButton('close')}
                onMouseLeave={() => setHoveredButton(null)}
            >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M1 1l8 8M9 1L1 9" />
                </svg>
            </button>
        </div>
    );
};

export default WindowControls;
