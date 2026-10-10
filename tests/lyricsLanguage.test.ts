import { describe, expect, it } from 'vitest';
import { detectLyricLanguage } from '../shared/lyricsLanguage';

describe('detectLyricLanguage cascade classifier', () => {
  describe('Japanese (ja)', () => {
    it('detects standard Japanese with Kanji and Kana', () => {
      expect(detectLyricLanguage('夜明けのステージに光が差す')).toBe('ja');
      expect(detectLyricLanguage('君の声が星空へ響いていく')).toBe('ja');
    });

    it('detects Japanese with Katakana loanwords or title', () => {
      expect(detectLyricLanguage('ロマンスの神様')).toBe('ja');
      expect(detectLyricLanguage('アイドル')).toBe('ja');
      expect(detectLyricLanguage('メロディー')).toBe('ja');
    });

    it('detects Japanese with Hiragana only', () => {
      expect(detectLyricLanguage('ありがとう')).toBe('ja');
      expect(detectLyricLanguage('ずっといっしょに')).toBe('ja');
    });

    it('detects Japanese with mixed English', () => {
      expect(detectLyricLanguage('Hello また会える日まで We will shine')).toBe('ja');
    });
  });

  describe('Korean (ko)', () => {
    it('detects pure Korean Hangul lyrics', () => {
      expect(detectLyricLanguage('안녕하세요')).toBe('ko');
      expect(detectLyricLanguage('보고 싶다 이렇게 말하니까 더 보고 싶다')).toBe('ko');
      expect(detectLyricLanguage('감사합니다 친구들')).toBe('ko');
    });

    it('detects Korean with English and punctuation', () => {
      expect(detectLyricLanguage('I love you 사랑해 forever')).toBe('ko');
      expect(detectLyricLanguage('1, 2, 3! 같이 가자~')).toBe('ko');
    });
  });

  describe('Chinese (zh) - Simplified & Traditional', () => {
    it('detects Simplified Chinese lyrics', () => {
      expect(detectLyricLanguage('夜空中最亮的星')).toBe('zh');
      expect(detectLyricLanguage('后来我总算学会了如何去爱')).toBe('zh');
      expect(detectLyricLanguage('每一次都在徘徊孤单中坚强')).toBe('zh');
    });

    it('detects Traditional Chinese lyrics', () => {
      expect(detectLyricLanguage('原諒我這一生不羈放縱愛自由')).toBe('zh');
      expect(detectLyricLanguage('海闊天空')).toBe('zh');
      expect(detectLyricLanguage('說好不哭 晴天')).toBe('zh');
    });

    it('detects Chinese with mixed English', () => {
      expect(detectLyricLanguage('Hello 朋友，今天過得好嗎？')).toBe('zh');
    });

    it('detects Taiwanese Bopomofo (Zhuyin)', () => {
      expect(detectLyricLanguage('ㄅㄆㄇㄈ')).toBe('zh');
    });
  });

  describe('Non-CJK / Empty (none)', () => {
    it('returns none for English lyrics', () => {
      expect(detectLyricLanguage('Never gonna give you up')).toBe('none');
      expect(detectLyricLanguage('Just a small town girl, living in a lonely world')).toBe('none');
    });

    it('returns none for numbers, punctuation, or whitespace', () => {
      expect(detectLyricLanguage('1234567890')).toBe('none');
      expect(detectLyricLanguage('... --- ... !?!')).toBe('none');
      expect(detectLyricLanguage('   \n\t  ')).toBe('none');
      expect(detectLyricLanguage('')).toBe('none');
    });
  });
});
