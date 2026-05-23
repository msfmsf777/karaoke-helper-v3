import { describe, expect, it } from 'vitest';
import { resolveReleaseNotes } from '../shared/releaseNotes';

const catalog = {
  version: '3.3.0-beta',
  locales: {
    'zh-TW': {
      title: '繁中標題',
      summary: '繁中摘要',
      sections: [
        { title: '重點', items: ['繁中項目'] },
      ],
    },
    en: {
      title: 'English title',
      summary: 'English summary',
      sections: [
        { title: 'Highlights', items: ['English item'] },
      ],
    },
    ja: {
      title: '日本語タイトル',
      sections: [
        { title: '更新内容', body: '日本語本文' },
      ],
    },
  },
};

describe('release notes localization', () => {
  it('returns the selected supported language when available', () => {
    const notes = resolveReleaseNotes(catalog, 'ja');

    expect(notes?.language).toBe('ja');
    expect(notes?.title).toBe('日本語タイトル');
    expect(notes?.sections[0]?.body).toBe('日本語本文');
  });

  it('falls back to English before Traditional Chinese', () => {
    const notes = resolveReleaseNotes(catalog, 'ko');

    expect(notes?.language).toBe('en');
    expect(notes?.title).toBe('English title');
  });

  it('falls back to Traditional Chinese if English is missing', () => {
    const notes = resolveReleaseNotes({
      version: '3.3.0-beta',
      locales: {
        'zh-TW': catalog.locales['zh-TW'],
      },
    }, 'th');

    expect(notes?.language).toBe('zh-TW');
    expect(notes?.title).toBe('繁中標題');
  });
});
