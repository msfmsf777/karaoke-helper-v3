import React, { useState, useEffect, useRef } from 'react';

interface ScrollingTextProps {
    text: string;
    style?: React.CSSProperties;
}

const ScrollingText: React.FC<ScrollingTextProps> = ({ text, style }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const content = textRef.current;
        if (!container || !content) return;

        const checkOverflow = () => {
            const overflow = content.scrollWidth - container.clientWidth;
            if (overflow > 0) {
                setIsOverflowing(true);
                container.style.setProperty('--scroll-offset', `-${overflow}px`);
                // Adjust speed: 50px per second roughly? Or fixed time?
                // Original logic: Math.max(5, overflow * 0.05)
                // Let's make it a bit slower/smoother.
                container.style.setProperty('--scroll-duration', `${Math.max(5, overflow * 0.1)}s`);
            } else {
                setIsOverflowing(false);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [text]);

    return (
        <div ref={containerRef} style={{ ...style, overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', position: 'relative' }}>
            <div
                ref={textRef}
                className={isOverflowing ? 'scrolling-text' : ''}
                style={{ display: 'inline-block' }}
            >
                {text}
            </div>
            <style>{`
                .scrolling-text {
                    animation: pingpong var(--scroll-duration, 5s) linear infinite alternate;
                    animation-delay: 2s;
                }
                @keyframes pingpong {
                    0%, 20% { transform: translateX(0); }
                    80%, 100% { transform: translateX(var(--scroll-offset)); }
                }
            `}</style>
        </div>
    );
};

export default ScrollingText;
