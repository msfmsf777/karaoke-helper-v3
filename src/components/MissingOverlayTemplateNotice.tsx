import React from 'react';
import { useTranslation } from 'react-i18next';

interface MissingOverlayTemplateNoticeProps {
  requestedDesignId?: string | null;
}

const MissingOverlayTemplateNotice: React.FC<MissingOverlayTemplateNoticeProps> = ({ requestedDesignId }) => {
  const { t } = useTranslation();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.72)',
      color: '#fff',
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
      padding: 32,
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: 720,
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: 18,
        background: 'rgba(18, 18, 18, 0.86)',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
        padding: '28px 34px',
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12 }}>
          {t('overlays.missingTemplate.title')}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: 17, lineHeight: 1.6 }}>
          {t('overlays.missingTemplate.description')}
        </div>
        {requestedDesignId && (
          <div style={{
            marginTop: 18,
            color: 'rgba(255, 255, 255, 0.48)',
            fontSize: 13,
            lineHeight: 1.4,
            wordBreak: 'break-all',
          }}>
            {t('overlays.missingTemplate.requestedId', { id: requestedDesignId })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingOverlayTemplateNotice;
