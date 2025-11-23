import React from 'react';

const SkeletonSongRow: React.FC = () => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid #2a2a2a',
                height: '60px',
                gap: '16px',
            }}
        >
            {/* Index / Play Icon */}
            <div
                style={{
                    width: '30px',
                    height: '16px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                }}
            />

            {/* Title & Artist */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                    style={{
                        width: '40%',
                        height: '16px',
                        backgroundColor: '#333',
                        borderRadius: '4px',
                    }}
                />
                <div
                    style={{
                        width: '25%',
                        height: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '4px',
                    }}
                />
            </div>

            {/* Type Badge */}
            <div
                style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '12px',
                }}
            />

            {/* Status Badge */}
            <div
                style={{
                    width: '60px',
                    height: '20px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '12px',
                }}
            />

            {/* Duration */}
            <div
                style={{
                    width: '40px',
                    height: '14px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                }}
            />
        </div>
    );
};

interface SkeletonSongListProps {
    count?: number;
}

const SkeletonSongList: React.FC<SkeletonSongListProps> = ({ count = 10 }) => {
    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonSongRow key={i} />
            ))}
        </div>
    );
};

export default SkeletonSongList;
