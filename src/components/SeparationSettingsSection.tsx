import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSeparationEnv } from '../contexts/SeparationEnvContext';
import type { SeparationStorageInfo } from '../../shared/separationTypes';
import {
  getSeparationDiskUsage,
  uninstallSeparationEnv,
  getSeparationStorageInfo,
} from '../jobs/separationJobs';
import { SeparationMigrationModal } from './SeparationMigrationModal';
import FolderOpenIcon from '../assets/icons/folder_open.svg';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const SeparationSettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const {
    envStatus,
    gpuInfo,
    isInstalling,
    installProgress,
    openSetupModal,
    cancelInstall,
    refreshStatus,
    switchMode,
    rescanFolder,
  } = useSeparationEnv();

  const [diskUsage, setDiskUsage] = useState<number | null>(null);
  const [storageInfo, setStorageInfo] = useState<SeparationStorageInfo | null>(null);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const [bytes, storage] = await Promise.all([
        getSeparationDiskUsage(),
        getSeparationStorageInfo(),
      ]);
      setDiskUsage(bytes);
      setStorageInfo(storage);
    } catch {
      setDiskUsage(null);
    }
  }, []);

  const handleModeSelect = async (mode: 'gpu' | 'cpu') => {
    if (envStatus?.mode === mode || isSwitchingMode) return;
    setIsSwitchingMode(true);
    try {
      const res = await switchMode(mode);
      if (res.requiresInstall) {
        openSetupModal();
      }
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      await rescanFolder();
      await fetchDetails();
    } finally {
      setIsRescanning(false);
    }
  };

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails, envStatus]);

  const handleOpenFolder = () => {
    if (storageInfo?.currentPath) {
      void window.api?.openExternal?.(`file://${storageInfo.currentPath}`);
    }
  };

  const handleUninstall = async () => {
    if (!window.confirm(t('settings.separationEngine.confirmUninstall', '確定要移除分離引擎嗎？此操作將釋放磁碟空間，下次分離歌曲時需要重新安裝。'))) {
      return;
    }
    setIsUninstalling(true);
    try {
      await uninstallSeparationEnv();
      await refreshStatus();
      await fetchDetails();
    } catch (err) {
      console.error('Failed to uninstall separation env', err);
    } finally {
      setIsUninstalling(false);
    }
  };

  const isReady = envStatus?.status === 'ready';
  const isCpuMode = envStatus?.mode === 'cpu';
  const hasGpuUpgradeOpportunity = isReady && isCpuMode && gpuInfo?.hasCapableGpu;

  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{ display: 'block', marginBottom: '12px', color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
        {t('settings.separationEngine.title', 'AI 分離引擎與硬體加速')}
      </label>

      <div
        style={{
          backgroundColor: '#27272a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Status Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>
              {isReady ? (envStatus.mode === 'gpu' ? '⚡' : '💻') : isInstalling ? '⏳' : '⚙️'}
            </span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5' }}>
                {isReady
                  ? envStatus.mode === 'gpu'
                    ? t('settings.separationEngine.modeGpuActive', 'NVIDIA GPU 硬體加速 (CUDA)')
                    : t('settings.separationEngine.modeCpuActive', '標準 CPU 處理模式')
                  : isInstalling
                  ? t('settings.separationEngine.installing', '正在安裝分離引擎...')
                  : t('settings.separationEngine.notInstalled', '尚未配置分離引擎')}
              </div>
              <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px' }}>
                {gpuInfo?.modelName
                  ? `${gpuInfo.modelName}${gpuInfo.vramMb ? ` (${(gpuInfo.vramMb / 1024).toFixed(1)} GB VRAM)` : ''}`
                  : t('settings.separationEngine.hardwareUnknown', '硬體檢測完成')}
                {diskUsage !== null && diskUsage > 0 && ` • ${t('settings.separationEngine.diskUsage', '佔用空間')}: ${formatBytes(diskUsage)}`}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isReady ? (
              <>
                <button
                  onClick={openSetupModal}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#3f3f46',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f4f4f5',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('settings.separationEngine.btnReconfigure', '切換模式 / 重新配置')}
                </button>
                <button
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {t('settings.separationEngine.btnUninstall', '釋放空間')}
                </button>
              </>
            ) : isInstalling ? (
              <>
                <button
                  onClick={openSetupModal}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#6366f1',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('settings.separationEngine.btnViewProgress', '查看進度')}
                </button>
                <button
                  onClick={cancelInstall}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel', '取消')}
                </button>
              </>
            ) : (
              <button
                onClick={openSetupModal}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
                }}
              >
                {t('settings.separationEngine.btnConfigureNow', '立即配置引擎')}
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector Row (instant toggle without re-downloading) */}
        {isReady && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#1f1f23',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                {t('settings.separationEngine.activeMode', '當前運算模式')}:
              </span>
              <span style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 600 }}>
                {envStatus?.mode === 'gpu' ? '⚡ NVIDIA GPU (CUDA)' : '💻 CPU'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => void handleModeSelect('gpu')}
                disabled={isSwitchingMode}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: envStatus?.mode === 'gpu' ? '#6366f1' : '#2c2c34',
                  border: envStatus?.mode === 'gpu' ? '1px solid #818cf8' : '1px solid #444',
                  color: envStatus?.mode === 'gpu' ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: envStatus?.mode === 'gpu' ? 600 : 400,
                  cursor: isSwitchingMode ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ⚡ {t('settings.separationEngine.gpu', 'GPU 加速')}
              </button>
              <button
                onClick={() => void handleModeSelect('cpu')}
                disabled={isSwitchingMode}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: envStatus?.mode === 'cpu' ? '#6366f1' : '#2c2c34',
                  border: envStatus?.mode === 'cpu' ? '1px solid #818cf8' : '1px solid #444',
                  color: envStatus?.mode === 'cpu' ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: envStatus?.mode === 'cpu' ? 600 : 400,
                  cursor: isSwitchingMode ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                💻 {t('settings.separationEngine.cpu', 'CPU 模式')}
              </button>
            </div>
          </div>
        )}

        {/* Error Alert Card if status is error */}
        {envStatus?.status === 'error' && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#fca5a5', lineHeight: 1.4 }}>
              ⚠️ <strong>{t('settings.separationEngine.errorTitle', '分離引擎狀態異常')}</strong>
              {envStatus.errorMessage && <div style={{ marginTop: '2px', color: '#f87171' }}>{envStatus.errorMessage}</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRescan}
                disabled={isRescanning}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#27272a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f4f4f5',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {isRescanning ? t('common.loading', '掃描中...') : t('settings.separationEngine.btnRescan', '重新掃描')}
              </button>
              <button
                onClick={openSetupModal}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('settings.separationEngine.btnReconfigure', '重新配置')}
              </button>
            </div>
          </div>
        )}

        {/* Upgrade Banner if running CPU on capable GPU */}
        {hasGpuUpgradeOpportunity && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#c7d2fe', lineHeight: 1.4 }}>
              💡 <strong>{t('settings.separationEngine.upgradeAvailable', '檢測到獨立 NVIDIA 顯示卡！')}</strong>
              {' '}
              {t('settings.separationEngine.upgradeDesc', '升級至 GPU 加速可大幅縮短分離耗時（每首歌約 15–30 秒）。')}
            </div>
            <button
              onClick={openSetupModal}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#6366f1',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('settings.separationEngine.btnUpgradeGpu', '升級 GPU 加速')}
            </button>
          </div>
        )}

        {/* Storage Location Card (matching Song Library UI) */}
        {storageInfo && (
          <div
            style={{
              background: '#1f1f23',
              border: '1px solid #383842',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {t('settings.separationEngine.storageLocationTitle', '分離引擎儲存位置')}:
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: storageInfo.isDefault ? '#333' : 'rgba(99, 102, 241, 0.15)',
                      color: storageInfo.isDefault ? '#aaa' : '#818cf8',
                      fontWeight: 600,
                    }}
                  >
                    {storageInfo.isDefault
                      ? t('settings.separationEngine.defaultBadge', '預設 AppData (C: 槽)')
                      : t('settings.separationEngine.customBadge', '自訂目錄')}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    fontFamily: 'Consolas, monospace',
                    color: '#e4e4e7',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={storageInfo.currentPath}
                >
                  {storageInfo.currentPath}
                </div>
              </div>

              {/* Open in Explorer & Change Location button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleOpenFolder}
                  title={t('settings.separationEngine.openInExplorer', '在檔案總管中開啟')}
                  style={{
                    background: '#2c2c34',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img src={FolderOpenIcon} alt="open" style={{ width: '14px', height: '14px', opacity: 0.8 }} />
                </button>

                <button
                  onClick={handleRescan}
                  disabled={isRescanning}
                  title={t('settings.separationEngine.btnRescan', '重新掃描目錄')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#2c2c34',
                    border: '1px solid #444',
                    color: '#d4d4d8',
                    fontSize: '12px',
                    cursor: isRescanning ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isRescanning ? t('common.loading', '掃描中...') : t('settings.separationEngine.btnRescan', '重新掃描')}
                </button>

                <button
                  onClick={() => setShowMigrationModal(true)}
                  disabled={isInstalling}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#3f3f46',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f4f4f5',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: isInstalling ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('settings.separationEngine.btnChangeLocation', '變更儲存位置...')}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#71717a' }}>
              <span>{t('settings.separationEngine.freeDriveSpace', '該磁碟剩餘空間')}: {formatBytes(storageInfo.freeDriveBytes)}</span>
            </div>
          </div>
        )}

        {/* Installing Progress bar if actively running */}
        {isInstalling && installProgress && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>
              <span>{installProgress.message}</span>
              <span>{installProgress.percent}%</span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${installProgress.percent}%`,
                  backgroundColor: '#6366f1',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Migration Modal */}
      {storageInfo && (
        <SeparationMigrationModal
          isOpen={showMigrationModal}
          currentStorage={storageInfo}
          onClose={() => setShowMigrationModal(false)}
          onStorageChanged={() => {
            void fetchDetails();
            void refreshStatus();
          }}
        />
      )}
    </div>
  );
};
