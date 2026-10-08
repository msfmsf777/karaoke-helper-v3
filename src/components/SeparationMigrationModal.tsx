import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SeparationStorageInfo, SeparationMigrationProgress } from '../../shared/separationTypes';
import {
  pickSeparationFolder,
  preflightSeparationTarget,
  startSeparationMigration,
  cancelSeparationMigration,
  subscribeSeparationMigrationProgress,
} from '../jobs/separationJobs';

interface SeparationMigrationModalProps {
  currentStorage: SeparationStorageInfo;
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

export const SeparationMigrationModal: React.FC<SeparationMigrationModalProps> = ({
  currentStorage,
  isOpen,
  onClose,
  onStorageChanged,
}) => {
  const { t } = useTranslation();

  const [selectedPath, setSelectedPath] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [preflight, setPreflight] = useState<{ valid: boolean; freeBytes: number; error?: string } | null>(null);
  const [migration, setMigration] = useState<SeparationMigrationProgress | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const isRunning = migration?.status === 'preparing' || migration?.status === 'copying' || migration?.status === 'verifying';
  const isCompleted = migration?.status === 'completed';

  useEffect(() => {
    if (isOpen) {
      setStartError(null);
      setSelectedPath('');
      setPreflight(null);
      setMigration(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeSeparationMigrationProgress((prog) => {
      setMigration(prog);
      if (prog.status === 'completed') {
        onStorageChanged();
      }
    });
    return () => { unsub(); };
  }, [isOpen, onStorageChanged]);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    try {
      setStartError(null);
      const picked = await pickSeparationFolder();
      if (!picked) return;
      setSelectedPath(picked);
      setChecking(true);
      setPreflight(null);
      const res = await preflightSeparationTarget(picked, { forMigration: true });
      setPreflight(res);
    } catch (err: unknown) {
      console.error('[SeparationMigration] Pick folder failed', err);
      setStartError((err as Error).message || '選擇目錄失敗');
    } finally {
      setChecking(false);
    }
  };

  const handleStart = async () => {
    if (!selectedPath || !preflight?.valid || startLoading) return;
    setStartLoading(true);
    setStartError(null);
    try {
      const prog = await startSeparationMigration(selectedPath);
      setMigration(prog);
      if (prog.status === 'completed') {
        onStorageChanged();
      }
    } catch (err: unknown) {
      console.error('[SeparationMigration] Start migration failed', err);
      setStartError((err as Error)?.message || '搬移失敗');
    } finally {
      setStartLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSeparationMigration();
    } catch (err: unknown) {
      console.error('[SeparationMigration] Cancel failed', err);
    }
  };

  const percent = migration && migration.totalBytes > 0
    ? Math.round((migration.transferredBytes / migration.totalBytes) * 100)
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#1a1a20',
          border: '1px solid #333',
          borderRadius: '14px',
          width: '560px',
          maxWidth: '92vw',
          padding: '24px',
          color: '#fff',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a2a30', paddingBottom: '14px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span>
            <span>{t('settings.separationEngine.migrationTitle', '變更 AI 分離引擎儲存目錄')}</span>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: '20px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        {!isRunning && !isCompleted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Current Source Info */}
            <div style={{ background: '#24242c', padding: '14px 16px', borderRadius: '8px', border: '1px solid #32323e' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                {t('settings.separationEngine.currentFolder', '目前儲存目錄')}
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', color: '#e4e4e7' }}>
                {currentStorage.currentPath}
              </div>
              <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '6px' }}>
                {t('settings.separationEngine.diskUsage', '佔用空間')}: {formatBytes(currentStorage.totalBytes)}
              </div>
            </div>

            {/* Target Folder Selection */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: '#ddd' }}>
                {t('settings.separationEngine.selectNewFolder', '選擇新儲存目錄')}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  readOnly
                  value={selectedPath}
                  placeholder={t('settings.separationEngine.pickFolderPlaceholder', '請點擊瀏覽選擇新目錄...')}
                  style={{
                    flex: 1,
                    background: '#121216',
                    border: '1px solid #3a3a46',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handlePickFolder}
                  disabled={checking}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#30303c',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {checking ? t('common.loading', '檢查中...') : t('settings.separationEngine.browse', '瀏覽...')}
                </button>
              </div>

              {/* Preflight Status */}
              {preflight && (
                <div style={{ marginTop: '10px', fontSize: '12px' }}>
                  {preflight.valid ? (
                    <div style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>✓</span>
                      <span>
                        {t('settings.separationEngine.preflightPassed', '磁碟空間充足，可用空間：{{space}}', {
                          space: formatBytes(preflight.freeBytes),
                        })}
                      </span>
                    </div>
                  ) : (
                    <div style={{ color: '#ef4444' }}>
                      ❌ {preflight.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {startError && (
              <div style={{ color: '#ef4444', fontSize: '12px' }}>
                ❌ {startError}
              </div>
            )}
          </div>
        ) : isRunning ? (
          /* Migrating Progress View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {migration?.status === 'verifying'
                  ? t('settings.separationEngine.verifyingIntegrity', '正在校驗檔案完整性...')
                  : t('settings.separationEngine.movingFiles', '正在搬移分離環境檔案...')}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace' }}>
                {percent}%
              </span>
            </div>

            <div style={{ height: '8px', background: '#272730', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  backgroundColor: '#6366f1',
                  borderRadius: '4px',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888' }}>
              <span>{migration ? formatBytes(migration.transferredBytes) : '0 B'} / {formatBytes(migration?.totalBytes || currentStorage.totalBytes)}</span>
              {migration?.currentFile && (
                <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {migration.currentFile}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Completed View */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
            <div style={{ fontSize: '36px' }}>🎉</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#4ade80' }}>
              {t('settings.separationEngine.migrationCompleted', '分離引擎目錄搬移完成！')}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa', textAlign: 'center', lineHeight: 1.5 }}>
              {t('settings.separationEngine.migrationCompletedDesc', '已成功將分離引擎搬移至新目錄，日後分離歌曲將直接自新位置調用。')}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #2a2a30', paddingTop: '16px' }}>
          {!isRunning && !isCompleted && (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  color: '#bbb',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedPath || !preflight?.valid || startLoading}
                style={{
                  padding: '8px 20px',
                  backgroundColor: (!selectedPath || !preflight?.valid || startLoading) ? '#444' : '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (!selectedPath || !preflight?.valid || startLoading) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {startLoading ? t('common.loading', '正在啟動...') : t('settings.separationEngine.startMigration', '開始搬移')}
              </button>
            </>
          )}

          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '8px 18px',
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#f87171',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel', '取消搬移')}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#27272a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#f4f4f5',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('separationSetup.btnBackground', '在背景繼續執行 ▾')}
              </button>
            </div>
          )}

          {isCompleted && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('common.confirm', '完成')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
