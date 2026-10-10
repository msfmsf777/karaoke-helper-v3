export type LyricLanguage = 'ja' | 'zh' | 'ko' | 'none';

/**
 * Detects whether lyrics text is Japanese, Korean, Chinese, or non-CJK.
 *
 * Cascade heuristic:
 * 1. If any Hiragana or Katakana is found -> Japanese ('ja'). Kana is unique to Japanese.
 * 2. If any Hangul syllable or jamo is found -> Korean ('ko'). Hangul is unique to Korean.
 * 3. If CJK Hanzi/Bopomofo is found (without Kana or Hangul) -> Chinese ('zh'). Covers Simplified & Traditional.
 * 4. Otherwise -> 'none' (e.g. English, Latin script, numbers, instrumental).
 */
export function detectLyricLanguage(text: string): LyricLanguage {
  if (!text) return 'none';

  let kanaCount = 0;
  let hangulCount = 0;
  let hanziCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // Hiragana (0x3040-0x309F) & Katakana (0x30A0-0x30FF)
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
      kanaCount++;
    }
    // Hangul Syllables (0xAC00-0xD7AF), Hangul Jamo (0x1100-0x11FF), Compatibility Jamo (0x3130-0x318F)
    else if (
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0x1100 && code <= 0x11FF) ||
      (code >= 0x3130 && code <= 0x318F)
    ) {
      hangulCount++;
    }
    // Hanzi / CJK Ideographs (0x4E00-0x9FFF, 0x3400-0x4DBF), Bopomofo (0x3100-0x312F)
    else if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x3100 && code <= 0x312F)
    ) {
      hanziCount++;
    }
  }

  // 1. Japanese heuristic: Kana is strictly unique to Japanese
  if (kanaCount > 0) {
    return 'ja';
  }

  // 2. Korean heuristic: Hangul is unique to Korean
  if (hangulCount > 0) {
    return 'ko';
  }

  // 3. Chinese heuristic: Hanzi without Kana/Hangul is Chinese
  if (hanziCount > 0) {
    return 'zh';
  }

  return 'none';
}
