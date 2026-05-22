import React, { useEffect, useState } from 'react';
import LogoImage from '../assets/images/logo.png';
import WebIcon from '../assets/icons/web.svg';
import XIcon from '../assets/icons/x.svg';
import DiscordIcon from '../assets/icons/discord.svg';
import BugIcon from '../assets/icons/bug.svg';
import { useUpdater } from '../contexts/UpdaterContext';
import pkg from '../../package.json';
import { useTranslation } from 'react-i18next';

// Configuration for social links - Edit here to change links
const SOCIAL_LINKS = [
    {
        id: 'website',
        url: 'https://github.com/msfmsf777/karaoke-helper-v3', // TODO: Enter official site URL
        titleKey: 'about.links.website.title',
        icon: WebIcon,
        labelKey: 'about.links.website.label',
        bgColor: 'var(--accent-color)',
        iconSize: 22,
        border: 'none',
    },
    {
        id: 'twitter',
        url: 'https://x.com/msfmsf777', // TODO: Enter X (Twitter) URL
        titleKey: 'about.links.twitter.title',
        icon: XIcon,
        labelKey: 'about.links.twitter.label',
        bgColor: '#000',
        iconSize: 20,
        border: '1px solid #333',
    },
    {
        id: 'discord',
        url: 'https://discord.gg/96zfTcBgZG', // TODO: Enter Discord invite URL
        titleKey: 'about.links.discord.title',
        icon: DiscordIcon,
        labelKey: 'about.links.discord.label',
        bgColor: '#5865F2',
        iconSize: 26,
        border: 'none',
    },
    {
        id: 'report',
        url: 'https://github.com/msfmsf777/karaoke-helper-v3/issues/new', // TODO: Enter issue report URL
        titleKey: 'about.links.report.title',
        icon: BugIcon,
        labelKey: 'about.links.report.label',
        bgColor: '#ff4d4d',
        iconSize: 22,
        border: 'none',
    },
];

interface AboutPopupProps {
    open: boolean;
    onClose: () => void;
}

const AboutPopup: React.FC<AboutPopupProps> = ({ open, onClose }) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const { checkForUpdates, downloadUpdate, installUpdate, status } = useUpdater();
    const isUpdaterBusy = status === 'checking' || status === 'downloading' || status === 'installing';
    const updateButtonLabel = status === 'checking'
        ? t('settings.updates.checking')
        : status === 'downloading'
            ? t('updatesPopup.status.downloading')
            : status === 'installing'
                ? t('updatesPopup.status.installing')
                : status === 'available'
                    ? t('updatesPopup.updateNow')
                    : status === 'downloaded'
                        ? t('updatesPopup.restart')
                        : t('settings.updates.check');
    const handleUpdaterAction = () => {
        if (status === 'available') {
            downloadUpdate();
            return;
        }
        if (status === 'downloaded') {
            installUpdate();
            return;
        }
        checkForUpdates(true);
    };

    useEffect(() => {
        if (open) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [open]);

    if (!visible && !open) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: open ? 1 : 0,
                transition: 'opacity 0.2s ease-in-out',
                pointerEvents: open ? 'auto' : 'none',
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={onClose}
            />

            {/* Popup Content */}
            <div
                style={{
                    position: 'relative',
                    width: '420px',
                    backgroundColor: '#1f1f1f',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transform: open ? 'scale(1)' : 'scale(0.95)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                {/* Check Update Button (Top Left) */}
                <button
                    onClick={handleUpdaterAction}
                    disabled={isUpdaterBusy}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'none',
                        border: '1px solid #444',
                        color: '#aaa',
                        cursor: isUpdaterBusy ? 'wait' : 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s, color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (!isUpdaterBusy) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = '#fff';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isUpdaterBusy) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#aaa';
                        }
                    }}
                >
                    {updateButtonLabel}
                </button>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s, color 0.2s',
                        width: '32px',
                        height: '32px',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#888';
                    }}
                >
                    <span style={{ fontSize: '24px', lineHeight: '1' }}>×</span>
                </button>

                {/* Logo & Title */}
                <img
                    src={LogoImage}
                    alt="KHelper Logo"
                    style={{
                        width: '72px',
                        height: '72px',
                        objectFit: 'contain',
                        marginBottom: '-5px',
                    }}
                />
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>
                    KHelper V3
                </h2>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                    V{pkg.version}
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 24px', fontSize: '13px', lineHeight: '1.6', color: '#ccc', maxWidth: '95%' }}>
                    {t('about.descriptionLine1')}
                    <br />
                    {t('about.descriptionLine2')}
                </p>

                {/* Links */}
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                    {SOCIAL_LINKS.map((link) => (
                        <div
                            key={link.id}
                            onClick={() => {
                                if (link.url && link.url !== '#') {
                                    window.api.openExternal(link.url);
                                }
                            }}
                            title={t(link.titleKey)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none',
                                color: '#fff',
                                fontSize: '12px',
                                transition: 'transform 0.2s',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                backgroundColor: link.bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: link.border
                            }}>
                                <img src={link.icon} alt={t(link.labelKey)} style={{ width: `${link.iconSize}px`, height: `${link.iconSize}px` }} />
                            </div>
                            <span>{t(link.labelKey)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AboutPopup;
