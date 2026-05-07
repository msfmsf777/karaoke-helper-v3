import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS, SupportedLanguage, normalizeLanguage } from '../../shared/i18n';

interface LanguageSelectorProps {
  value: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
}

const flagModules = import.meta.glob<string>('../assets/flags/*.svg', {
  eager: true,
  import: 'default',
});

const codeCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function getFlagSrc(flag: string): string | undefined {
  return flagModules[`../assets/flags/${flag}.svg`];
}

function getDisplayName(locale: SupportedLanguage, displayLocale: SupportedLanguage, fallback: string): string {
  try {
    return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(locale) ?? fallback;
  } catch {
    return fallback;
  }
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  const options = useMemo(() => (
    [...LANGUAGE_OPTIONS].sort((a, b) => codeCollator.compare(a.code, b.code))
  ), []);

  const displayOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options
      .map((option) => {
        const localizedName = getDisplayName(option.code, currentLanguage, option.englishName);
        return {
          ...option,
          localizedName,
          flagSrc: getFlagSrc(option.flag),
          searchText: `${option.code} ${option.nativeName} ${option.englishName} ${localizedName}`.toLowerCase(),
        };
      })
      .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery));
  }, [currentLanguage, options, query]);

  const selectedOption = displayOptions.find((option) => option.code === value)
    ?? options.find((option) => option.code === value);
  const selectedLocalizedName = selectedOption
    ? getDisplayName(selectedOption.code, currentLanguage, selectedOption.englishName)
    : value;
  const selectedFlagSrc = selectedOption ? getFlagSrc(selectedOption.flag) : undefined;

  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectLanguage = (language: SupportedLanguage) => {
    onChange(language);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(displayOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && displayOptions[activeIndex]) {
      event.preventDefault();
      selectLanguage(displayOptions[activeIndex].code);
    }
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '360px',
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: '100%',
          minHeight: '42px',
          padding: '8px 12px',
          backgroundColor: '#2a2a2a',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {selectedFlagSrc && (
          <img src={selectedFlagSrc} alt="" aria-hidden="true" style={{ width: '28px', height: '18px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />
        )}
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption?.nativeName ?? value}
          </span>
          <span style={{ color: '#aaa', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedLocalizedName}
          </span>
        </span>
        <span aria-hidden="true" style={{ color: '#aaa', fontSize: '12px' }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            backgroundColor: '#252525',
            border: '1px solid #444',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
            zIndex: 2000,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px' }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('settings.language.searchPlaceholder')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                backgroundColor: '#1b1b1b',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '13px',
              }}
            />
          </div>

          <div role="listbox" aria-label={t('settings.language.label')} style={{ maxHeight: '260px', overflowY: 'auto', padding: '0 4px 4px' }}>
            {displayOptions.length === 0 ? (
              <div style={{ padding: '12px', color: '#888', fontSize: '13px' }}>
                {t('settings.language.noResults')}
              </div>
            ) : displayOptions.map((option, index) => (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={option.code === value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectLanguage(option.code)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: option.code === value ? 'rgba(255,255,255,0.12)' : (index === activeIndex ? 'rgba(255,255,255,0.06)' : 'transparent'),
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {option.flagSrc && (
                  <img src={option.flagSrc} alt="" aria-hidden="true" style={{ width: '28px', height: '18px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{option.nativeName}</span>
                  <span style={{ color: '#bbb', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.localizedName}</span>
                </span>
                {option.code === value && (
                  <span style={{ color: 'var(--accent-color)', fontSize: '12px', flexShrink: 0 }}>
                    {t('settings.language.current')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
