import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { separationQuality, setSeparationQuality } = useUserData();

  const refreshDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await audioEngine.enumerateOutputDevices();
      setDevices(list);
    } catch (err) {
      console.error('[Settings] Failed to enumerate devices', err);
      setError(t('settings.audio.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    refreshDevices();
  }, [open, refreshDevices]);

  const deviceOptions = useMemo(() => {
    return [
      { deviceId: '', label: t('settings.audio.systemDefault') },
      ...devices.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || t('settings.audio.device', { index: idx + 1 }),
      })),
    ];
  }, [devices, t]);

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
          <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{t('common.settings')}</h2>
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
            {loading ? t('settings.audio.scanning') : t('settings.audio.scan')}
          </button>
        </div>
        <p style={{ margin: '0 0 16px', color: '#b3b3b3', fontSize: '14px' }}>
          {t('settings.audio.description')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
              {t('settings.audio.streamOutput')}
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
              {t('settings.audio.headphoneOutput')}
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
              {t('settings.separation.title')}
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
                {t('settings.separation.fast')} - {t('settings.separation.fastDescription')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="separationQuality"
                  value="normal"
                  checked={separationQuality === 'normal'}
                  onChange={() => setSeparationQuality('normal')}
                />
                {t('settings.separation.normal')} - {t('settings.separation.normalDescription')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="separationQuality"
                  value="high"
                  checked={separationQuality === 'high'}
                  onChange={() => setSeparationQuality('high')}
                />
                {t('settings.separation.high')} - {t('settings.separation.highDescription')}
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
