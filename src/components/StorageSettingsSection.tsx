import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorageInfo, MigrationProgress } from '../../shared/songTypes';
import { StorageMigrationModal } from './StorageMigrationModal';
import FolderOpenIcon from '../assets/icons/folder_open.svg';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const StorageSettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [migration, setMigration] = useState<MigrationProgress | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshStorage = useCallback(async () => {
    try {
      const info = await window.khelper?.storage.getInfo();
      if (info) setStorageInfo(info);
    } catch (err) {
      console.error('[StorageSettings] Failed to fetch storage info', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStorage();

    const unsub = window.khelper?.storage.subscribeProgress((prog) => {
      setMigration(prog);
      if (prog.status === 'completed') {
        void refreshStorage();
      }
    });
    return () => { unsub?.(); };
  }, [refreshStorage]);

  const handleOpenFolder = () => {
    if (storageInfo?.currentPath) {
      void window.khelper?.songLibrary.openSongFolder?.('');
      // Or fallback: open explorer using electron shell via IPC
      void window.api?.openExternal?.(`file://${storageInfo.currentPath}`);
    }
  };

  const isRunning = migration?.status === 'running' || migration?.status === 'verifying';

  return (
    <section id="settings-storage" style={{ marginBottom: '40px', scrollMarginTop: 24 }}>
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: '18px',
        color: '#fff',
        borderLeft: '4px solid var(--accent-color)',
        paddingLeft: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <img
          src={FolderOpenIcon}
          alt=""
          aria-hidden="true"
          style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)', opacity: 0.9, flexShrink: 0 }}
        />
        <span>{t('settings.storage.title', 'Song Library Storage')}</span>
      </h2>

      <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
        <p style={{ margin: '0 0 20px', color: '#aaa', fontSize: '14px', lineHeight: 1.6 }}>
          {t('settings.storage.description', 'Manage where your songs, AI vocal separation stems, and lyrics are stored on your computer.')}
        </p>

        {loading ? (
          <div style={{ color: '#888', fontSize: '13px' }}>{t('settings.storage.loading', 'Loading storage details...')}</div>
        ) : storageInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Main Path Card */}
            <div style={{
              background: '#1f1f1f',
              border: '1px solid #383838',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>
                      {t('settings.storage.currentFolder', 'Current Storage Path')}:
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: storageInfo.isDefault ? '#333' : 'rgba(100, 180, 255, 0.15)',
                      color: storageInfo.isDefault ? '#aaa' : '#70bbff',
                      fontWeight: 600,
                    }}>
                      {storageInfo.isDefault ? t('settings.storage.defaultBadge', 'Default AppData (C: Drive)') : t('settings.storage.customBadge', 'Custom Directory')}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: '13px',
                    color: '#eee',
                    wordBreak: 'break-all',
                    background: '#181818',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #2d2d2d',
                  }}>
                    {storageInfo.currentPath}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenFolder}
                  title={t('settings.storage.openFolder', 'Open Folder in File Explorer')}
                  style={{
                    background: '#282828',
                    border: '1px solid #3a3a3a',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ccc',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '22px',
                    flexShrink: 0,
                  }}
                >
                  <img src={FolderOpenIcon} alt="Open" style={{ width: '14px', height: '14px', filter: 'brightness(0) invert(1)' }} />
                  <span>{t('settings.storage.openInExplorer', 'Open Explorer')}</span>
                </button>
              </div>

              {/* Stats Bar */}
              <div style={{
                display: 'flex',
                gap: '24px',
                paddingTop: '10px',
                borderTop: '1px solid #2a2a2a',
                fontSize: '13px',
                color: '#aaa',
                flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ color: '#777' }}>{t('settings.storage.totalSongs', 'Total Songs')}: </span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{storageInfo.totalSongs}</span>
                </div>
                <div>
                  <span style={{ color: '#777' }}>{t('settings.storage.usedSpace', 'Used Space')}: </span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{formatBytes(storageInfo.totalBytes)}</span>
                </div>
                <div>
                  <span style={{ color: '#777' }}>{t('settings.storage.freeDriveSpace', 'Drive Free Space')}: </span>
                  <span style={{ color: '#8be28b', fontWeight: 600 }}>{formatBytes(storageInfo.freeBytes)}</span>
                </div>
              </div>
            </div>

            {/* In-Flight Migration Notice if active */}
            {isRunning && migration && (
              <div style={{
                background: 'rgba(224, 160, 64, 0.08)',
                border: '1px solid rgba(224, 160, 64, 0.3)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e0a040', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📦</span>
                    <span>{t('settings.storage.migrationActive', 'Migration in Progress')}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e0a040' }}>{migration.percent}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${migration.percent}%`, height: '100%', background: '#e0a040', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>
                    {migration.currentSongTitle ? `[${migration.copiedSongs}/${migration.totalSongs}] ${migration.currentSongTitle}` : `${migration.copiedSongs}/${migration.totalSongs}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#70bbff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {t('settings.storage.viewDetails', 'View Details / Cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Action Button */}
            {!isRunning && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  style={{
                    background: 'var(--accent-color, #ff5577)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {t('settings.storage.changeLocationButton', 'Change Storage Location / Migrate...')}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Migration Modal */}
      {storageInfo && (
        <StorageMigrationModal
          currentStorage={storageInfo}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onStorageChanged={() => void refreshStorage()}
        />
      )}
    </section>
  );
};
