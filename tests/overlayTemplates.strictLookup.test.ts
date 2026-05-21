import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OVERLAY_DESIGN_ID,
  createDefaultOverlayTemplatesConfig,
  createDefaultSetlistConfig,
  createLyricsDesign,
  createSetlistDesign,
  getLyricsOverlayDesignById,
  getSetlistOverlayDesignById,
  mergeOverlayTemplatesConfig,
  resolveOverlayDesign,
} from '../shared/overlayTemplates';

describe('strict overlay design lookup', () => {
  const base = createDefaultOverlayTemplatesConfig();
  const customLyrics = createLyricsDesign('lyrics-custom', 'Custom Lyrics', base.lyricsDesigns[0]);
  const customSetlist = createSetlistDesign('setlist-custom', 'Custom Setlist', base.setlistDesigns[0]);
  const config = {
    ...base,
    lyricsDesigns: [base.lyricsDesigns[0], customLyrics],
    setlistDesigns: [base.setlistDesigns[0], customSetlist],
  };

  it('returns exact lyrics and setlist designs by id', () => {
    expect(getLyricsOverlayDesignById(config, 'lyrics-custom')?.id).toBe('lyrics-custom');
    expect(getSetlistOverlayDesignById(config, 'setlist-custom')?.id).toBe('setlist-custom');
  });

  it('does not fall back when an explicit design id is missing', () => {
    expect(getLyricsOverlayDesignById(config, 'missing-lyrics')).toBeUndefined();
    expect(getSetlistOverlayDesignById(config, 'missing-setlist')).toBeUndefined();
  });

  it('resolves an existing explicit design with ok status', () => {
    const result = resolveOverlayDesign(config, 'setlist', 'setlist-custom');

    expect(result.status).toBe('ok');
    expect(result.requestedDesignId).toBe('setlist-custom');
    expect(result.designId).toBe('setlist-custom');
    expect(result.design.id).toBe('setlist-custom');
  });

  it('returns missing status for an explicit missing design id', () => {
    const result = resolveOverlayDesign(config, 'lyrics', 'missing-lyrics');

    expect(result.status).toBe('missing');
    expect(result.requestedDesignId).toBe('missing-lyrics');
    expect('design' in result).toBe(false);
  });

  it('uses default design when no explicit design id is requested', () => {
    const result = resolveOverlayDesign(config, 'lyrics', null);

    expect(result.status).toBe('ok');
    expect(result.requestedDesignId).toBeUndefined();
    expect(result.designId).toBe(DEFAULT_OVERLAY_DESIGN_ID);
    expect(result.design.id).toBe(DEFAULT_OVERLAY_DESIGN_ID);
  });
});

describe('setlist overlay overall opacity', () => {
  it('defaults each setlist template to an intentional opacity', () => {
    const expectedDefaults = {
      classic_list: 0.38,
      record_card: 0.52,
      compact_strip: 0.52,
      neon_signboard: 0.38,
      countdown_counter: 0.86,
      index_grid: 0.52,
      pager_console: 1,
      cassette_deck: 0.9,
      stage_marquee: 0.38,
      photo_stack: 0.9,
      vertical_column: 0,
      spinning_disk_list: 0.6,
    } as const;

    Object.entries(expectedDefaults).forEach(([templateId, opacity]) => {
      expect(createDefaultSetlistConfig(templateId as keyof typeof expectedDefaults).overallOpacity).toBe(opacity);
    });
  });

  it('preserves and clamps saved setlist design opacity', () => {
    const config = mergeOverlayTemplatesConfig({
      version: 2,
      activeLyricsDesignId: DEFAULT_OVERLAY_DESIGN_ID,
      activeSetlistDesignId: DEFAULT_OVERLAY_DESIGN_ID,
      lyricsDesigns: [],
      setlistDesigns: [
        {
          id: DEFAULT_OVERLAY_DESIGN_ID,
          name: 'Saved',
          config: {
            templateId: 'classic_list',
            overallOpacity: 1.4,
          },
        },
        {
          id: 'soft',
          name: 'Soft',
          config: {
            templateId: 'compact_strip',
            overallOpacity: 0.42,
          },
        },
      ],
    });

    expect(config.setlistDesigns[0].config.overallOpacity).toBe(1);
    expect(config.setlistDesigns[1].config.overallOpacity).toBe(0.42);
  });
});
