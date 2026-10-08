import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSeparationEnv } from '../contexts/SeparationEnvContext';
import type { SeparationEngineMode, SeparationStorageInfo } from '../../shared/separationTypes';
import {
  getSeparationStorageInfo,
  pickSeparationFolder,
  preflightSeparationTarget,
} from '../jobs/separationJobs';

export const SeparationSetupModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isSetupModalOpen,
    closeSetupModal,
    gpuInfo,
    installProgress,
    isInstalling,
    startInstall,
    cancelInstall,
    pendingJob,
  } = useSeparationEnv();

  const [selectedMode, setSelectedMode] = useState<SeparationEngineMode>('gpu');
  const [storageInfo, setStorageInfo] = useState<SeparationStorageInfo | null>(null);
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Pre-select mode based on hardware detection
  useEffect(() => {
    if (gpuInfo?.hasCapableGpu) {
      setSelectedMode('gpu');
    } else {
      setSelectedMode('cpu');
    }
  }, [gpuInfo]);

  useEffect(() => {
    if (isSetupModalOpen) {
      void getSeparationStorageInfo().then((info) => {
        setStorageInfo(info);
      });
    }
  }, [isSetupModalOpen]);

  if (!isSetupModalOpen) return null;

  const handlePickFolder = async () => {
    try {
      setFolderError(null);
      setPickingFolder(true);
      const picked = await pickSeparationFolder();
      if (!picked) return;
      const preflight = await preflightSeparationTarget(picked);
      if (!preflight.valid) {
        setFolderError(preflight.error || '目標路徑無效');
        return;
      }
      setCustomPath(picked);
      const current = await getSeparationStorageInfo();
      setStorageInfo({
        ...current,
        currentPath: picked,
        isDefault: false,
        freeDriveBytes: preflight.freeBytes,
        driveLetter: picked.split(':')[0] || 'C',
      });
    } catch (err: unknown) {
      setFolderError((err as Error).message || '選擇目錄失敗');
    } finally {
      setPickingFolder(false);
    }
  };

  const handleStart = () => {
    void startInstall(selectedMode, customPath || undefined);
  };

  const handleBackground = () => {
    closeSetupModal();
  };

  const progressPercent = installProgress?.percent ?? 0;
  const isError = installProgress?.stage === 'error';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isInstalling) {
          closeSetupModal();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#1a1a1f',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2)',
          color: '#f0f0f5',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {t('separationSetup.title', 'AI 人聲分離引擎設定')}
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#9a9aa8', lineHeight: 1.4 }}>
              {t('separationSetup.subtitle', '初次使用需配置 AI 分離依賴套件。配置完成後將永久保存在本機，程式更新無須重新下載。')}
            </p>
          </div>
          {!isInstalling && (
            <button
              onClick={closeSetupModal}
              style={{
                background: 'none',
                border: 'none',
                color: '#8e8e9f',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={t('common.close', '關閉')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hardware Detection Badge */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: gpuInfo?.hasCapableGpu
                ? 'rgba(74, 222, 128, 0.08)'
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${
                gpuInfo?.hasCapableGpu ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.08)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{gpuInfo?.hasCapableGpu ? '🎮' : '💻'}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: gpuInfo?.hasCapableGpu ? '#86efac' : '#e2e8f0' }}>
                  {gpuInfo?.modelName || '硬體檢測中...'}
                  {gpuInfo?.vramMb ? ` (${(gpuInfo.vramMb / 1024).toFixed(1)} GB VRAM)` : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {gpuInfo?.recommendationReason || t('separationSetup.detecting', '系統正在分析硬體加速能力...')}
                </div>
              </div>
            </div>
            {gpuInfo?.hasCapableGpu && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(74, 222, 128, 0.18)',
                  color: '#4ade80',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('separationSetup.badgeCudaReady', '支援 CUDA 加速')}
              </span>
            )}
          </div>

          {/* Mode Selection or Progress View */}
          {!isInstalling ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Option A: GPU Acceleration */}
              <div
                onClick={() => setSelectedMode('gpu')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: `2px solid ${
                    selectedMode === 'gpu' ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'
                  }`,
                  backgroundColor: selectedMode === 'gpu' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="separationMode"
                  checked={selectedMode === 'gpu'}
                  onChange={() => setSelectedMode('gpu')}
                  style={{ marginTop: '3px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>
                        {t('separationSetup.gpuTitle', 'NVIDIA GPU 硬體加速')}
                      </span>
                      {gpuInfo?.hasCapableGpu && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#6366f1',
                            color: '#fff',
                          }}
                        >
                          {t('separationSetup.recommended', '強烈推薦')}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>
                      ⚡ ~15–30s / 首
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#a1a1aa', lineHeight: 1.4 }}>
                    {t('separationSetup.gpuDesc', '利用 NVIDIA 顯示卡張量核心極速分離，處理時間縮減至幾十秒。需要下載約 1.8 GB PyTorch CUDA 依賴。')}
                  </p>
                </div>
              </div>

              {/* Option B: CPU Mode */}
              <div
                onClick={() => setSelectedMode('cpu')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: `2px solid ${
                    selectedMode === 'cpu' ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'
                  }`,
                  backgroundColor: selectedMode === 'cpu' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="separationMode"
                  checked={selectedMode === 'cpu'}
                  onChange={() => setSelectedMode('cpu')}
                  style={{ marginTop: '3px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>
                      {t('separationSetup.cpuTitle', '標準 CPU 處理模式')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      🐢 ~5–10m / 首
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#a1a1aa', lineHeight: 1.4 }}>
                    {t('separationSetup.cpuDesc', '相容於所有電腦。由處理器運算，下載體積較小（約 600 MB），但高品質模式處理時間顯著較長。')}
                  </p>
                </div>
              </div>

              {/* Storage Location Selector */}
              {storageInfo && (
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>
                      {t('separationSetup.storageLocation', '安裝儲存位置')}
                    </span>
                    <button
                      onClick={handlePickFolder}
                      disabled={pickingFolder}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#818cf8',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      {pickingFolder ? t('common.loading', '載入中...') : t('separationSetup.btnChangeFolder', '變更目錄...')}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px' }}>📁</span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#e4e4e7',
                        fontFamily: 'Consolas, monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                      title={storageInfo.currentPath}
                    >
                      {storageInfo.currentPath}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: storageInfo.isDefault ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.2)',
                        color: storageInfo.isDefault ? '#a1a1aa' : '#818cf8',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {storageInfo.isDefault ? t('separationSetup.defaultBadge', '預設 AppData') : t('separationSetup.customBadge', '自訂目錄')}
                    </span>
                  </div>

                  {folderError && (
                    <div style={{ color: '#ef4444', fontSize: '12px' }}>
                      ❌ {folderError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Installation Progress Display */
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  {installProgress?.message || t('separationSetup.installingTitle', '正在安裝分離引擎...')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace' }}>
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: '#27272a',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(progressPercent, 100)}%`,
                    backgroundColor: isError ? '#ef4444' : '#6366f1',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {installProgress?.detail && (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#71717a',
                    fontFamily: 'Consolas, monospace',
                    wordBreak: 'break-all',
                    maxHeight: '40px',
                    overflow: 'hidden',
                  }}
                >
                  {installProgress.detail}
                </div>
              )}

              {isError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>
                  ❌ {installProgress?.error || t('separationSetup.errorOccurred', '安裝發生錯誤')}
                </div>
              )}

              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                💡 {t('separationSetup.backgroundHint', '下載檔案較大，您可以點擊下方「在背景繼續執行」，安裝過程將在右上角任務面板持續顯示，您可以正常瀏覽歌曲。')}
              </p>
            </div>
          )}

          {pendingJob && (
            <div style={{ fontSize: '12px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎵</span>
              <span>
                {t('separationSetup.autoResumeHint', '安裝就緒後，系統將自動開始分離您所選取的歌曲。')}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          {!isInstalling ? (
            <>
              <button
                onClick={closeSetupModal}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: '#d4d4d8',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                onClick={handleStart}
                style={{
                  padding: '9px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                {selectedMode === 'gpu'
                  ? t('separationSetup.btnInstallGpu', '安裝並啟用 GPU 加速')
                  : t('separationSetup.btnInstallCpu', '安裝 CPU 引擎')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={cancelInstall}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('separationSetup.btnCancelInstall', '取消安裝')}
              </button>
              <button
                onClick={handleBackground}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#27272a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f4f4f5',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('separationSetup.btnBackground', '在背景繼續執行 ▾')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
