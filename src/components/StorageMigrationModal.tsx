import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorageInfo, StoragePreflightResult, MigrationProgress } from '../../shared/songTypes';
import { useLibrary } from '../contexts/LibraryContext';

interface StorageMigrationModalProps {
  currentStorage: StorageInfo;
  isOpen: boolean;
  onClose: () => void;
  onStorageChanged: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const StorageMigrationModal: React.FC<StorageMigrationModalProps> = ({
  currentStorage,
  isOpen,
  onClose,
  onStorageChanged,
}) => {
  const { t } = useTranslation();
  const { refreshSongs } = useLibrary();

  const [selectedPath, setSelectedPath] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [preflight, setPreflight] = useState<StoragePreflightResult | null>(null);
  const [switchMode, setSwitchMode] = useState<'move' | 'switch'>('move');
  const [migration, setMigration] = useState<MigrationProgress | null>(null);
  const [reloading, setReloading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Snapshot the source location before migrating so completion always references where we came from
  const [sourceSnapshot, setSourceSnapshot] = useState<{
    path: string;
    isDefault: boolean;
    totalBytes: number;
  }>({
    path: currentStorage.currentPath,
    isDefault: currentStorage.isDefault,
    totalBytes: currentStorage.totalBytes,
  });

  const isRunning = migration?.status === 'running' || migration?.status === 'verifying';
  const isCompleted = migration?.status === 'completed';
  const isFailed = migration?.status === 'failed';

  useEffect(() => {
    if (isOpen) {
      setStartError(null);
    }
    if (isOpen && !isRunning && !isCompleted) {
      setSourceSnapshot({
        path: currentStorage.currentPath,
        isDefault: currentStorage.isDefault,
        totalBytes: currentStorage.totalBytes,
      });
    }
  }, [isOpen, isRunning, isCompleted, currentStorage.currentPath, currentStorage.isDefault, currentStorage.totalBytes]);

  // Subscribe to progress
  useEffect(() => {
    if (!isOpen) return;
    const unsub = window.khelper?.storage.subscribeProgress((prog) => {
      setMigration(prog);
      if (prog.status === 'completed') {
        onStorageChanged();
        void refreshSongs();
      }
    });
    return () => { unsub?.(); };
  }, [isOpen, onStorageChanged, refreshSongs]);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    try {
      setStartError(null);
      const picked = await window.khelper?.storage.pickFolder();
      if (!picked) return;
      setSelectedPath(picked);
      setChecking(true);
      setPreflight(null);
      const res = await window.khelper?.storage.preflight(picked);
      setPreflight(res || null);
      if (res?.canDirectSwitch) {
        setSwitchMode('switch');
      } else {
        setSwitchMode('move');
      }
    } catch (err: unknown) {
      console.error('[StorageModal] Pick folder failed', err);
    } finally {
      setChecking(false);
    }
  };

  const handleStart = async () => {
    if (!selectedPath || !preflight || startLoading) return;
    setStartLoading(true);
    setStartError(null);
    setSourceSnapshot({
      path: currentStorage.currentPath,
      isDefault: currentStorage.isDefault,
      totalBytes: currentStorage.totalBytes,
    });
    try {
      const prog = await window.khelper?.storage.startMigration(selectedPath, switchMode);
      if (prog) {
        setMigration(prog);
        if (prog.status === 'completed') {
          onStorageChanged();
          void refreshSongs();
        }
      }
    } catch (err: unknown) {
      console.error('[StorageModal] Start migration failed', err);
      setStartError((err as Error)?.message || 'Migration failed to start');
    } finally {
      setStartLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await window.khelper?.storage.cancelMigration();
    } catch (err: unknown) {
      console.error('[StorageModal] Cancel failed', err);
    }
  };

  const handleReload = async (cleanupOldPath?: string) => {
    setReloading(true);
    try {
      await window.khelper?.storage.reload(cleanupOldPath);
    } catch (err: unknown) {
      console.error('[StorageModal] Reload failed', err);
      setReloading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '12px',
        width: '560px',
        maxWidth: '92vw',
        padding: '24px',
        color: '#fff',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a2a2a', paddingBottom: '14px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span>
            <span>{t('settings.storage.modalTitle', 'Change Song Storage Location')}</span>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: '20px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Content based on state */}
        {!isRunning && !isCompleted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Current Path Card */}
            <div style={{ background: '#252525', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ color: '#888', marginBottom: '4px' }}>{t('settings.storage.currentLocation', 'Current Location')}:</div>
              <div style={{ fontFamily: 'Consolas, monospace', color: '#ccc', wordBreak: 'break-all' }}>
                {currentStorage.currentPath}
              </div>
              <div style={{ color: '#aaa', marginTop: '6px', fontSize: '12px' }}>
                {currentStorage.totalSongs} {t('settings.storage.songsCount', 'songs')} · {formatBytes(currentStorage.totalBytes)}
              </div>
            </div>

            {/* Folder Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                {t('settings.storage.selectNewLocation', 'Select New Destination Folder')}:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={selectedPath}
                  placeholder={t('settings.storage.placeholder', 'Click browse to select a folder...')}
                  style={{
                    flex: 1,
                    background: '#151515',
                    border: '1px solid #3a3a3a',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'Consolas, monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={checking}
                  style={{
                    background: 'var(--accent-color, #ff5577)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: checking ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {checking ? t('settings.storage.checking', 'Checking...') : t('settings.storage.browse', 'Browse...')}
                </button>
              </div>
            </div>

            {/* Preflight Results */}
            {preflight && !preflight.valid && (
              <div style={{ background: 'rgba(255, 80, 80, 0.1)', border: '1px solid #ff5555', borderRadius: '8px', padding: '12px', color: '#ff9999', fontSize: '13px' }}>
                ⚠️ {preflight.error}
              </div>
            )}

            {preflight && preflight.valid && (
              <div style={{ background: '#252525', border: '1px solid #383838', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                  <span>{t('settings.storage.driveFree', 'Destination Drive Free Space')}:</span>
                  <span style={{ fontWeight: 600, color: '#8be28b' }}>{formatBytes(preflight.targetFreeBytes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                  <span>{t('settings.storage.spaceRequired', 'Space Required to Move')}:</span>
                  <span style={{ fontWeight: 600 }}>{formatBytes(preflight.totalBytes)}</span>
                </div>

                {/* Option switch if existing songs detected */}
                {preflight.canDirectSwitch && (
                  <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #333' }}>
                    <div style={{ color: '#e0a040', marginBottom: '8px', fontWeight: 600 }}>
                      ℹ️ {t('settings.storage.existingSongsDetected', 'Existing KHelper library detected in this folder ({{count}} songs)', { count: preflight.existingSongCountInTarget })}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
                      <input
                        type="radio"
                        name="switchMode"
                        value="switch"
                        checked={switchMode === 'switch'}
                        onChange={() => setSwitchMode('switch')}
                      />
                      <span>{t('settings.storage.directSwitchOption', 'Direct Switch (Use existing songs in folder without moving files)')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="switchMode"
                        value="move"
                        checked={switchMode === 'move'}
                        onChange={() => setSwitchMode('move')}
                      />
                      <span>{t('settings.storage.mergeOption', 'Copy & Merge current library into destination folder')}</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Error starting migration/switch */}
            {startError && (
              <div style={{ background: 'rgba(255, 80, 80, 0.1)', border: '1px solid #ff5555', borderRadius: '8px', padding: '12px', color: '#ff9999', fontSize: '13px' }}>
                ⚠️ {startError}
              </div>
            )}
          </div>
        )}

        {/* Running state */}
        {isRunning && migration && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>
                {migration.status === 'verifying' ? t('tasks.migration.verifying', 'Verifying files...') : t('tasks.migration.moving', 'Migrating Songs...')}
              </span>
              <span style={{ fontSize: '14px', color: '#e0a040', fontWeight: 600 }}>{migration.percent}%</span>
            </div>

            <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${migration.percent}%`, height: '100%', background: 'var(--accent-color, #ff5577)', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ fontSize: '13px', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {migration.currentSongTitle ? `[${migration.copiedSongs}/${migration.totalSongs}] ${migration.currentSongTitle}` : `${migration.copiedSongs}/${migration.totalSongs}`}
              </span>
              <span>{formatBytes(migration.copiedBytes)} / {formatBytes(migration.totalBytes)}</span>
            </div>

            <div style={{ fontSize: '12px', color: '#777', fontStyle: 'italic' }}>
              {t('settings.storage.backgroundNote', 'You can safely close this window. The migration will continue running in the background.')}
            </div>
          </div>
        )}

        {/* Failed state */}
        {isFailed && migration && (
          <div style={{ background: 'rgba(255, 80, 80, 0.1)', border: '1px solid #ff5555', borderRadius: '8px', padding: '14px', color: '#ff9999', fontSize: '13px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>❌ {t('tasks.migration.failed', 'Migration Failed')}</div>
            <div>{migration.error || 'Unknown error'}</div>
          </div>
        )}

        {/* Completed state */}
        {isCompleted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '32px' }}>🎉</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#8be28b' }}>
                  {switchMode === 'switch'
                    ? t('settings.storage.completeTitleSwitch', 'Library Switched!')
                    : t('settings.storage.completeTitle', 'Library Successfully Moved!')}
                </div>
                <div style={{ fontSize: '13px', color: '#ccc', marginTop: '2px' }}>
                  {switchMode === 'switch'
                    ? t('settings.storage.completeSubtitleSwitch', 'KHelper is now configured to use the selected library.')
                    : t('settings.storage.completeSubtitle', 'Your songs were safely copied to the new location.')}
                </div>
              </div>
            </div>

            {switchMode === 'switch' ? (
              <div style={{ background: '#252525', border: '1px solid #383838', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#aaa', lineHeight: 1.5 }}>
                {t('settings.storage.reloadNoticeSwitch', 'Please reload KHelper to apply the new library path and re-index songs.')}
              </div>
            ) : (
              <div style={{ background: '#252525', border: '1px solid #383838', borderRadius: '8px', padding: '16px', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                  {sourceSnapshot.isDefault
                    ? t('settings.storage.cleanupTitleDefault', 'Free up AppData disk space?')
                    : t('settings.storage.cleanupTitleCustom', 'Free up previous storage folder?')}
                </div>
                <div style={{ color: '#aaa', lineHeight: 1.5 }}>
                  {sourceSnapshot.isDefault
                    ? t('settings.storage.cleanupDescDefault', 'The original song files (~{{size}}) are still stored in your AppData directory. Reloading will safely clean them up to free disk space, or you can keep them as a backup.', { size: formatBytes(sourceSnapshot.totalBytes) })
                    : t('settings.storage.cleanupDescCustom', 'The original song files (~{{size}}) are still stored in {{path}}. Reloading will safely clean them up to free disk space, or you can keep them as a backup.', { path: sourceSnapshot.path, size: formatBytes(sourceSnapshot.totalBytes) })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '16px' }}>
          {!isRunning && !isCompleted && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#aaa',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('settings.storage.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={startLoading || (!preflight?.valid && !(switchMode === 'switch' && preflight?.canDirectSwitch))}
                style={{
                  background: (startLoading || (!preflight?.valid && !(switchMode === 'switch' && preflight?.canDirectSwitch)))
                    ? '#444'
                    : 'var(--accent-color, #ff5577)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (startLoading || (!preflight?.valid && !(switchMode === 'switch' && preflight?.canDirectSwitch)))
                    ? 'not-allowed'
                    : 'pointer',
                }}
              >
                {startLoading
                  ? t('common.loading', 'Loading...')
                  : switchMode === 'switch'
                    ? t('settings.storage.startSwitch', 'Switch Library')
                    : t('settings.storage.startMove', 'Start Migration')}
              </button>
            </>
          )}

          {isRunning && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#aaa',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('settings.storage.runInBackground', 'Run in Background')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: '#ff4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('settings.storage.cancelMigration', 'Cancel Migration')}
              </button>
            </>
          )}

          {isCompleted && switchMode === 'switch' && (
            <button
              type="button"
              onClick={() => void handleReload()}
              disabled={reloading}
              style={{
                background: 'var(--accent-color, #ff5577)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: reloading ? 'wait' : 'pointer',
              }}
            >
              {reloading ? t('common.loading', 'Loading...') : t('settings.storage.reloadToApply', 'Reload KHelper to Apply')}
            </button>
          )}

          {isCompleted && switchMode === 'move' && (
            <>
              <button
                type="button"
                onClick={() => void handleReload()}
                disabled={reloading}
                style={{
                  background: 'none',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#ccc',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: reloading ? 'wait' : 'pointer',
                }}
              >
                {t('settings.storage.reloadKeepBackup', 'Reload (Keep Backup)')}
              </button>
              <button
                type="button"
                onClick={() => void handleReload(sourceSnapshot.path)}
                disabled={reloading}
                style={{
                  background: '#338833',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: reloading ? 'wait' : 'pointer',
                }}
              >
                {reloading ? t('common.loading', 'Loading...') : t('settings.storage.reloadAndClean', 'Reload & Free Up Space')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
