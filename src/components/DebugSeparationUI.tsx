import React, { useState, useRef, useEffect } from 'react';
import { useSeparationEnv } from '../contexts/SeparationEnvContext';
import type { SeparationJob } from '../../shared/separationTypes';

interface DebugSeparationUIProps {
  inline?: boolean;
}

export const DebugSeparationUI: React.FC<DebugSeparationUIProps> = ({ inline }) => {
  const { _debugSetState, _debugReset } = useSeparationEnv();
  const [isOpen, setIsOpen] = useState(false);
  const [injected, setInjected] = useState(false);

  // Position state (moveable anywhere on screen)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 310) : 100,
    y: typeof window !== 'undefined' ? Math.max(50, window.innerHeight - 620) : 80,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Drag listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 200, dragRef.current.posY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  // Strictly excluded in production builds
  if (import.meta.env.PROD) return null;
  if (!_debugSetState || !_debugReset) return null;

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        style={
          inline
            ? {
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                color: '#fff',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                verticalAlign: 'middle',
              }
            : {
                position: 'fixed',
                bottom: '100px', // Placed above the footer player
                right: '20px',
                backgroundColor: 'rgba(99, 102, 241, 0.9)',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: 'pointer',
                zIndex: 99999,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                // @ts-ignore
                WebkitAppRegion: 'no-drag',
              }
        }
      >
        <span>🛠️</span>
        <span>GPU SEP DEBUG</span>
      </div>
    );
  }

  // 1. Outdated driver scenarios
  const mockOutdatedRtx40 = () => {
    _debugSetState({
      gpuInfo: {
        hasCapableGpu: true,
        modelName: 'NVIDIA GeForce RTX 4070',
        vramMb: 12288,
        driverOutdated: true,
        minRequiredDriver: '528.33',
        driverUpdateUrl: 'https://www.nvidia.com/Download/index.aspx',
        recommendationReason: '檢測到 NVIDIA GPU，但驅動程式版本過舊 (< 528.33)',
      },
    });
  };

  const mockOutdatedRtx50 = () => {
    _debugSetState({
      gpuInfo: {
        hasCapableGpu: true,
        modelName: 'NVIDIA GeForce RTX 5080',
        vramMb: 16384,
        driverOutdated: true,
        minRequiredDriver: '572.16',
        driverUpdateUrl: 'https://www.nvidia.com/Download/index.aspx',
        recommendationReason: '檢測到 RTX 50 系列顯卡，需要驅動版本 >= 572.16',
      },
    });
  };

  const mockNormalGpu = () => {
    _debugSetState({
      gpuInfo: {
        hasCapableGpu: true,
        modelName: 'NVIDIA GeForce RTX 4070',
        vramMb: 12288,
        driverOutdated: false,
        minRequiredDriver: undefined,
        driverUpdateUrl: undefined,
        recommendationReason: '硬體具備完整的 CUDA 深度學習加速能力',
      },
    });
  };

  // 2. Engine status & probe error scenarios
  const mockKernelError = () => {
    _debugSetState({
      envStatus: {
        status: 'error',
        mode: 'gpu',
        errorMessage: '顯卡硬體或驅動程式與 PyTorch CUDA 核心不相容（CUDA kernel execution failed），建議更新顯卡驅動程式或切換至 CPU 模式。',
        cudaKernelFunctional: false,
      },
    });
  };

  const mockNoDeviceError = () => {
    _debugSetState({
      envStatus: {
        status: 'error',
        mode: 'gpu',
        errorMessage: 'GPU 加速環境校驗失敗（未偵測到 CUDA 裝置），請確認顯卡驅動程式支援。',
        cudaKernelFunctional: false,
      },
    });
  };

  const mockReadyGpu = () => {
    _debugSetState({
      envStatus: {
        status: 'ready',
        mode: 'gpu',
        supportedModes: ['gpu', 'cpu'],
        cudaKernelFunctional: true,
        installedAt: new Date().toISOString(),
      },
    });
  };

  const mockReadyCpu = () => {
    _debugSetState({
      envStatus: {
        status: 'ready',
        mode: 'cpu',
        supportedModes: ['cpu'],
        cudaKernelFunctional: undefined,
        installedAt: new Date().toISOString(),
      },
    });
  };

  // 3. Inject mock jobs into Task Pane
  const injectMockTaskPaneJobs = () => {
    const now = new Date().toISOString();
    const mockJobs: SeparationJob[] = [
      {
        id: `debug-gpu-${Date.now()}`,
        songId: 'mock-song-gpu',
        quality: 'normal',
        status: 'running',
        progress: 45,
        createdAt: now,
        updatedAt: now,
        engineMode: 'gpu',
      },
      {
        id: `debug-cpu-${Date.now()}`,
        songId: 'mock-song-cpu',
        quality: 'normal',
        status: 'running',
        progress: 68,
        createdAt: now,
        updatedAt: now,
        engineMode: 'cpu',
      },
      {
        id: `debug-fallback-running-${Date.now()}`,
        songId: 'mock-song-fallback',
        quality: 'high',
        status: 'running',
        progress: 30,
        createdAt: now,
        updatedAt: now,
        engineMode: 'cpu',
        fallbackNotice: 'GPU 加速執行失敗 (CUDA error: no kernel image is available for execution on the device)，已自動降級至 CPU 模式繼續處理。',
      },
      {
        id: `debug-fallback-done-${Date.now()}`,
        songId: 'mock-song-done',
        quality: 'normal',
        status: 'succeeded',
        progress: 100,
        createdAt: now,
        updatedAt: now,
        engineMode: 'cpu',
        fallbackNotice: 'GPU 加速執行失敗 (CUDA out of memory)，已自動降級至 CPU 模式繼續處理。',
      },
    ];

    (window as any).__khelper_debug_sep_jobs = mockJobs;
    window.dispatchEvent(new CustomEvent('khelper:debug-inject-sep-jobs', { detail: mockJobs }));
    setInjected(true);
  };

  // 4. Reset
  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    (window as any).__khelper_debug_sep_jobs = [];
    _debugReset();
    window.dispatchEvent(new CustomEvent('khelper:debug-clear-sep-jobs'));
    setInjected(false);
  };

  const btnStyle: React.CSSProperties = {
    padding: '5px 8px',
    backgroundColor: '#27272a',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '4px',
    color: '#e4e4e7',
    fontSize: '11px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '280px',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        backgroundColor: '#18181b',
        border: '1px solid #4338ca',
        borderRadius: '10px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
        padding: '12px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        color: '#fff',
        fontSize: '12px',
        userSelect: isDragging ? 'none' : 'auto',
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #27272a',
          paddingBottom: '6px',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        title="按住此處可拖曳移動浮動面板"
      >
        <strong style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🛠️</span> GPU Debugger <span style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 'normal' }}>⠿ 拖曳移動</span>
        </strong>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          style={{ cursor: 'pointer', color: '#a1a1aa', fontSize: '14px', padding: '0 4px' }}
        >
          ✕
        </span>
      </div>

      <div style={{ fontSize: '11px', color: '#a1a1aa' }}>1. 顯卡驅動警告測試 (Settings / Modal)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button style={btnStyle} onClick={mockOutdatedRtx40}>
          ⚠️ 模擬 RTX 4070 (驅動 &lt; 528.33)
        </button>
        <button style={btnStyle} onClick={mockOutdatedRtx50}>
          ⚠️ 模擬 RTX 5080 (驅動 &lt; 572.16)
        </button>
        <button style={btnStyle} onClick={mockNormalGpu}>
          ✓ 模擬正常驅動 (RTX 4070)
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px' }}>2. 分離引擎狀態測試 (Settings)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button style={btnStyle} onClick={mockKernelError}>
          💥 模擬核心架構錯誤 (Exit 3)
        </button>
        <button style={btnStyle} onClick={mockNoDeviceError}>
          ❌ 模擬無裝置錯誤 (Exit 2)
        </button>
        <button style={btnStyle} onClick={mockReadyGpu}>
          ⚡ 模擬 GPU 就緒模式
        </button>
        <button style={btnStyle} onClick={mockReadyCpu}>
          💻 模擬 CPU 就緒模式
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px' }}>3. 任務面板標籤測試 (Task Pane)</div>
      <button
        type="button"
        style={{
          ...btnStyle,
          backgroundColor: injected ? '#065f46' : '#312e81',
          borderColor: injected ? '#10b981' : '#4338ca',
          color: injected ? '#d1fae5' : '#e0e7ff',
          fontWeight: 600,
          cursor: 'pointer',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={injectMockTaskPaneJobs}
      >
        <span>{injected ? '✓ 已注入！(打開右上角任務面板)' : '📥 注入測試任務 (GPU / CPU / Fallback)'}</span>
        {injected && <span style={{ fontSize: '10px', color: '#a7f3d0' }}>已生效</span>}
      </button>

      <div style={{ borderTop: '1px solid #27272a', paddingTop: '6px', marginTop: '4px' }}>
        <button
          style={{ ...btnStyle, width: '100%', backgroundColor: '#3f3f46', textAlign: 'center', fontWeight: 600 }}
          onClick={handleReset}
        >
          🔄 還原真實硬體狀態 (Reset)
        </button>
      </div>
    </div>
  );
};

export default DebugSeparationUI;
