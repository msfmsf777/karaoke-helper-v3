import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { shouldPromptForAnalyticsConsent, type AnalyticsConsent } from '../../shared/analytics';
import { PRIVACY_NOTICE_URL } from '../constants/privacy';
import { useUserData } from '../contexts/UserDataContext';

const AnalyticsConsentModal = () => {
  const { t } = useTranslation();
  const { analytics, setAnalytics, settingsLoaded } = useUserData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  if (!settingsLoaded || !shouldPromptForAnalyticsConsent(analytics)) return null;

  const saveChoice = async (consent: Exclude<AnalyticsConsent, 'unset'>) => {
    if (!window.khelper?.analytics || saving) return;
    setSaving(true);
    setError(false);
    try {
      const saved = await window.khelper.analytics.setConsent(consent);
      setAnalytics(saved);
    } catch (err) {
      console.error('[Analytics] Failed to save consent choice', err);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-consent-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        background: 'rgba(0, 0, 0, 0.72)',
      }}
    >
      <div style={{
        position: 'relative',
        width: 'min(560px, 100%)',
        background: '#242424',
        border: '1px solid #424242',
        borderRadius: '10px',
        padding: '28px',
        boxShadow: '0 16px 42px rgba(0, 0, 0, 0.45)',
      }}>
        <button
          type="button"
          title={t('common.close')}
          aria-label={t('common.close')}
          onClick={() => window.khelper?.windowOps?.close()}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '30px',
            height: '30px',
            border: 0,
            borderRadius: '5px',
            background: 'transparent',
            color: '#bdbdbd',
            fontSize: '20px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          &times;
        </button>
        <h2 id="analytics-consent-title" style={{ margin: '0 0 10px', fontSize: '22px', color: '#fff' }}>
          {t('analyticsConsent.title')}
        </h2>
        <p style={{ margin: '0 0 22px', color: '#d0d0d0', fontSize: '14px', lineHeight: 1.6 }}>
          {t('analyticsConsent.description')}
        </p>
        <Disclosure title={t('analyticsConsent.collectedTitle')} text={t('analyticsConsent.collected')} />
        <Disclosure title={t('analyticsConsent.excludedTitle')} text={t('analyticsConsent.excluded')} />
        <button
          type="button"
          onClick={() => void window.api.openExternal(PRIVACY_NOTICE_URL)}
          style={{
            margin: '4px 0 22px',
            border: 0,
            padding: 0,
            background: 'transparent',
            color: '#70bbff',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {t('analyticsConsent.privacyNotice')}
        </button>
        {error && (
          <div role="alert" style={{ marginBottom: '16px', color: '#ff8e8e', fontSize: '13px' }}>
            {t('analyticsConsent.error')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ChoiceButton disabled={saving} onClick={() => void saveChoice('enabled')}>
            {t('analyticsConsent.allow')}
          </ChoiceButton>
          <ChoiceButton disabled={saving} onClick={() => void saveChoice('disabled')}>
            {t('analyticsConsent.decline')}
          </ChoiceButton>
        </div>
      </div>
    </div>
  );
};

const Disclosure = ({ title, text }: { title: string; text: string }) => (
  <div style={{ marginBottom: '15px' }}>
    <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{title}</div>
    <div style={{ color: '#b5b5b5', fontSize: '13px', lineHeight: 1.55 }}>{text}</div>
  </div>
);

const ChoiceButton = ({ children, disabled, onClick }: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      height: '44px',
      border: '1px solid #5a5a5a',
      borderRadius: '7px',
      background: '#313131',
      color: '#f2f2f2',
      fontSize: '14px',
      fontWeight: 600,
      cursor: disabled ? 'wait' : 'pointer',
      opacity: disabled ? 0.65 : 1,
    }}
  >
    {children}
  </button>
);

export default AnalyticsConsentModal;
