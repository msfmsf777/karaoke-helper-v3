import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alignEnrichedLyricLines,
  compactLyricLinesForEnrichment,
  parseLrc,
} from '../shared/lyrics.ts';
import {
  getTextOnlyVisibleLineRange,
  resolveLyricTimingState,
  shouldRenderLyricsOverlayContent,
} from '../shared/lyricsOverlayState.ts';
import {
  createTextOnlyLyricScrollAnchor,
  resolveScrollTopForTextOnlyLyricAnchor,
} from '../shared/lyricsScrollSync.ts';
import type { EnrichedLyricLine } from '../shared/songTypes.ts';

const makeEnriched = (text: string): EnrichedLyricLine => ({
  original: text,
  romaji: `${text}-romaji`,
  ruby: [{ surface: text, furigana: null }],
});

describe('lyrics parsing and Japanese assist alignment', () => {
  it('preserves timed blank LRC lines as timing anchors', () => {
    const lines = parseLrc('[00:00.00]first\n[00:05.00]\n[00:10.00]second');

    assert.equal(lines.length, 3);
    assert.equal(lines[1].text, '');
    assert.equal(lines[1].timeSeconds, 5);
  });

  it('aligns enriched non-empty lyrics back to original line indexes', () => {
    const lines = parseLrc('[00:00.00]first\n[00:05.00]\n[00:10.00]second');
    const compact = compactLyricLinesForEnrichment(lines);

    assert.deepEqual(compact.texts, ['first', 'second']);
    assert.deepEqual(compact.sourceIndexes, [0, 2]);

    const aligned = alignEnrichedLyricLines(lines, [
      makeEnriched('first'),
      makeEnriched('second'),
    ]);

    assert.equal(aligned[0]?.original, 'first');
    assert.equal(aligned[1], null);
    assert.equal(aligned[2]?.original, 'second');
  });
});

describe('OBS lyrics overlay state', () => {
  it('uses timed blank lines for timing but does not highlight text', () => {
    const lines = parseLrc('[00:00.00]first\n[00:05.00]\n[00:10.00]second');

    assert.deepEqual(resolveLyricTimingState('synced', lines, 5.4), {
      timingAnchorIndex: 1,
      activeTextIndex: -1,
    });
  });

  it('does not highlight any line for text-only lyrics', () => {
    const lines = parseLrc('first\nsecond');

    assert.deepEqual(resolveLyricTimingState('text_only', lines, 999), {
      timingAnchorIndex: -1,
      activeTextIndex: -1,
    });
  });

  it('does not render user-visible content for no-lyrics overlays', () => {
    assert.equal(shouldRenderLyricsOverlayContent('none', []), false);
  });

  it('limits text-only visible lyrics around the scroll anchor line', () => {
    assert.deepEqual(getTextOnlyVisibleLineRange({
      lineCount: 10,
      anchorLineIndex: 5,
      maxVisibleLines: 4,
    }), {
      start: 4,
      end: 7,
    });
  });
});

describe('text-only lyric scroll sync', () => {
  it('syncs by lyric line anchor instead of raw pixels across different layouts', () => {
    const appLayout = [
      { index: 0, top: 0, height: 20 },
      { index: 1, top: 30, height: 20 },
      { index: 2, top: 60, height: 20 },
    ];
    const overlayLayout = [
      { index: 0, top: 0, height: 50 },
      { index: 1, top: 70, height: 50 },
      { index: 2, top: 140, height: 50 },
    ];

    const anchor = createTextOnlyLyricScrollAnchor({
      lineLayouts: appLayout,
      scrollTop: 20,
      viewportHeight: 100,
    });

    assert.deepEqual(anchor, {
      anchorLineIndex: 2,
      anchorRatio: 0.5,
    });

    assert.equal(resolveScrollTopForTextOnlyLyricAnchor({
      anchor,
      lineLayouts: overlayLayout,
      viewportHeight: 100,
      maxScrollTop: 200,
    }), 115);
  });
});
