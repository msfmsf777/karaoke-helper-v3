import React, { useEffect, useMemo, useState } from 'react';
import audioEngine, { OutputRole } from '../audio/AudioEngine';
import { useUserData } from '../contexts/UserDataContext';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  streamDeviceId: string | null;
  headphoneDeviceId: string | null;
  onChangeDevice: (role: OutputRole, deviceId: string | null) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  streamDeviceId,
  headphoneDeviceId,
  onChangeDevice,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { separationQuality, setSeparationQuality } = useUserData();

  const refreshDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await audioEngine.enumerateOutputDevices();
      setDevices(list);
    } catch (err) {
      console.error('[Settings] Failed to enumerate devices', err);
      setError('無法取得音訊輸出裝置清單');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshDevices();
  }, [open]);

  const deviceOptions = useMemo(() => {
    return [
      { deviceId: '', label: '系統預設' },
      ...devices.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `裝置 ${idx + 1}`,
      })),
    ];
  }, [devices]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          background: '#1f1f1f',
          border: '1px solid #2f2f2f',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 12px 50px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>設定</h2>
          <button
            onClick={refreshDevices}
            style={{
              padding: '6px 10px',
              backgroundColor: '#2d2d2d',
              color: '#fff',
              border: '1px solid #3a3a3a',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? '掃描中...' : '重新掃描'}
          </button>
        </div>
        <p style={{ margin: '0 0 16px', color: '#b3b3b3', fontSize: '14px' }}>
          選擇 觀眾輸出（Stream）與 耳機輸出 的播放裝置。雙輸出共用同一份音訊內容，之後會再加入人聲/伴奏分離。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
              觀眾輸出裝置
            </label>
            <select
              value={streamDeviceId ?? ''}
              onChange={(e) => onChangeDevice('stream', e.target.value || null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#252525',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
              }}
            >
              {deviceOptions.map((opt) => (
                <option key={opt.deviceId} value={opt.deviceId}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
              耳機輸出裝置
            </label>
            <select
              value={headphoneDeviceId ?? ''}
              onChange={(e) => onChangeDevice('headphone', e.target.value || null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#252525',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
              }}
            >
              {deviceOptions.map((opt) => (
                <option key={opt.deviceId} value={opt.deviceId}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: '16px', marginTop: '8px' }}>
            <label style={{ display: 'block', marginBottom: '12px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
              分離品質 (Separation Quality)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="separationQuality"
                  value="fast"
                  checked={separationQuality === 'fast'}
                  onChange={() => setSeparationQuality('fast')}
                />
                快速（較省資源，音質略低）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="separationQuality"
                  value="normal"
                  checked={separationQuality === 'normal'}
                  onChange={() => setSeparationQuality('normal')}
                />
                標準（推薦）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="separationQuality"
                  value="high"
                  checked={separationQuality === 'high'}
                  onChange={() => setSeparationQuality('high')}
                />
                高品質（較慢，音質最佳）
              </label>
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#ff8080', marginTop: '12px', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px',
              backgroundColor: '#2d2d2d',
              color: '#fff',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
