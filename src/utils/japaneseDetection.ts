import { detectLyricLanguage } from '../../shared/lyricsLanguage';

export function isJapanese(text: string): boolean {
    return detectLyricLanguage(text) === 'ja';
}

