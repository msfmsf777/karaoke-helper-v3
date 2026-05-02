import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ObsLinkIcon from '../assets/icons/obs_link.svg';
import { useUserData } from '../contexts/UserDataContext';

interface StreamControlDropdownProps {
    onCopy: (label: string) => void;
    onOpenOverlaySettings?: () => void;
}

type OverlaySubmenu = 'lyrics' | 'setlist' | null;

const menuButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#eee',
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.1s',
    whiteSpace: 'nowrap',
    width: '100%',
};

const StreamControlDropdown: React.FC<StreamControlDropdownProps> = ({ onCopy, onOpenOverlaySettings }) => {
    const { t } = useTranslation();
    const { overlayTemplates } = useUserData();
    const [isOpen, setIsOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<OverlaySubmenu>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            setActiveSubmenu(null);
        }, 300);
    };

    const copyDesignLink = (kind: 'lyrics' | 'setlist', designId: string, designName: string) => {
        const url = `http://localhost:10001/obs/${kind}?design=${encodeURIComponent(designId)}`;
        navigator.clipboard.writeText(url);
        onCopy(t(kind === 'lyrics' ? 'lyrics.stream.copiedLyricsObs' : 'lyrics.stream.copiedSetlistObs', { name: designName }));
        setIsOpen(false);
        setActiveSubmenu(null);
    };

    const renderDesignSubmenu = (kind: 'lyrics' | 'setlist') => {
        const designs = kind === 'lyrics' ? overlayTemplates.lyricsDesigns : overlayTemplates.setlistDesigns;

        return (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 'calc(100% + 6px)',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    padding: '4px',
                    width: '220px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                }}
            >
                {designs.map((design) => (
                    <button
                        key={design.id}
                        onClick={() => copyDesignLink(kind, design.id, design.name)}
                        style={{
                            ...menuButtonStyle,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        onMouseEnter={(event) => event.currentTarget.style.backgroundColor = '#333'}
                        onMouseLeave={(event) => event.currentTarget.style.backgroundColor = 'transparent'}
                        title={design.name}
                    >
                        {design.name}
                    </button>
                ))}
            </div>
        );
    };

    const renderSubmenuTrigger = (kind: 'lyrics' | 'setlist', label: string) => (
        <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setActiveSubmenu(kind)}
        >
            <button
                style={{
                    ...menuButtonStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                }}
                onMouseEnter={(event) => event.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(event) => event.currentTarget.style.backgroundColor = 'transparent'}
            >
                <span>{label}</span>
                <span style={{ color: '#aaa' }}>›</span>
            </button>
            {activeSubmenu === kind && renderDesignSubmenu(kind)}
        </div>
    );

    return (
        <div
            style={{ position: 'relative', zIndex: 50 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className="stream-control-btn"
                style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: isOpen ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    transition: 'background-color 0.2s',
                }}
            >
                <img src={ObsLinkIcon} alt="OBS Link" style={{ width: '20px', height: '20px', filter: 'invert(1)' }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '210px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                }}>
                    {renderSubmenuTrigger('lyrics', t('lyrics.stream.copyLyricsObs'))}
                    {renderSubmenuTrigger('setlist', t('lyrics.stream.copySetlistObs'))}
                    {onOpenOverlaySettings && (
                        <>
                            <div style={{ height: 1, background: '#3a3a3a', margin: '3px 4px' }} />
                            <button
                                onClick={() => {
                                    onOpenOverlaySettings();
                                    setIsOpen(false);
                                    setActiveSubmenu(null);
                                }}
                                style={menuButtonStyle}
                                onMouseEnter={(event) => {
                                    setActiveSubmenu(null);
                                    event.currentTarget.style.backgroundColor = '#333';
                                }}
                                onMouseLeave={(event) => event.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {t('lyrics.stream.obsTemplateSettings')}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default StreamControlDropdown;
