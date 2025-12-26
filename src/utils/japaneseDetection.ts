export function isJapanese(text: string): boolean {
    if (!text) return false;

    let japaneseCount = 0;
    let totalCount = 0;
    let kanaCount = 0;

    for (const char of text) {
        const code = char.charCodeAt(0);

        const isHiragana = (code >= 0x3040 && code <= 0x309F);
        const isKatakana = (code >= 0x30A0 && code <= 0x30FF);
        const isKanji = (code >= 0x4E00 && code <= 0x9FAF);

        if (isHiragana || isKatakana) {
            kanaCount++;
        }

        if (isHiragana || isKatakana || isKanji) {
            japaneseCount++;
        }

        if (!/\s/.test(char)) {
            totalCount++;
        }
    }

    if (totalCount === 0) return false;

    // Heuristic:
    // If the text contains ANY Hiragana or Katakana, it is likely Japanese.
    // Kanji alone is insufficient (could be Chinese), but Kana is unique to Japanese.
    return kanaCount > 0;
}
