import {
  DEFAULT_LANGUAGE,
  GENERAL_FALLBACK_LANGUAGE,
  SupportedLanguage,
  normalizeLanguage,
} from './i18n';

export interface ReleaseNoteSection {
  title: string;
  body?: string;
  items?: string[];
}

export interface LocalizedReleaseNotes {
  title: string;
  summary?: string;
  sections: ReleaseNoteSection[];
}

export interface ReleaseNotesCatalog {
  version: string;
  locales: Partial<Record<SupportedLanguage, LocalizedReleaseNotes>>;
}

export interface ResolvedReleaseNotes extends LocalizedReleaseNotes {
  language: SupportedLanguage;
}

export const REQUIRED_RELEASE_NOTE_LOCALES: SupportedLanguage[] = [
  'zh-TW',
  'en',
  'zh-CN',
  'ja',
  'ko',
  'id',
  'th',
];

export function resolveReleaseNotes(
  catalog: ReleaseNotesCatalog | null | undefined,
  preferredLanguage: unknown,
): ResolvedReleaseNotes | null {
  if (!catalog?.locales) return null;

  const preferred = normalizeLanguage(preferredLanguage);
  const candidates: SupportedLanguage[] = [
    preferred,
    GENERAL_FALLBACK_LANGUAGE,
    DEFAULT_LANGUAGE,
  ];

  for (const language of candidates) {
    const notes = catalog.locales[language];
    if (isLocalizedReleaseNotes(notes)) {
      return { ...notes, language };
    }
  }

  return null;
}

export function isReleaseNotesCatalog(value: unknown): value is ReleaseNotesCatalog {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseNotesCatalog>;
  if (typeof candidate.version !== 'string' || !candidate.version.trim()) return false;
  if (!candidate.locales || typeof candidate.locales !== 'object') return false;

  return Object.values(candidate.locales).every((notes) => (
    notes === undefined || isLocalizedReleaseNotes(notes)
  ));
}

function isLocalizedReleaseNotes(value: unknown): value is LocalizedReleaseNotes {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalizedReleaseNotes>;
  if (typeof candidate.title !== 'string' || !candidate.title.trim()) return false;
  if (candidate.summary !== undefined && typeof candidate.summary !== 'string') return false;
  if (!Array.isArray(candidate.sections)) return false;
  return candidate.sections.every(isReleaseNoteSection);
}

function isReleaseNoteSection(value: unknown): value is ReleaseNoteSection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseNoteSection>;
  if (typeof candidate.title !== 'string' || !candidate.title.trim()) return false;
  if (candidate.body !== undefined && typeof candidate.body !== 'string') return false;
  if (candidate.items !== undefined) {
    if (!Array.isArray(candidate.items)) return false;
    if (!candidate.items.every((item) => typeof item === 'string')) return false;
  }
  return candidate.body !== undefined || candidate.items !== undefined;
}
