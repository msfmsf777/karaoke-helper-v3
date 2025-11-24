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
    // 1. Must have at least some Kana (to distinguish from Chinese)
    // 2. Japanese characters (Kana + Kanji) must make up a significant portion (> 15%)
    return kanaCount > 0 && (japaneseCount / totalCount > 0.15);
}
