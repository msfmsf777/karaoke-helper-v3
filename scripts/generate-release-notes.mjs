import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_LOCALES = ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'id', 'th'];
const DISPLAY_ORDER = ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'id', 'th'];
const LOCALE_LABELS = {
  'zh-TW': '繁體中文',
  en: 'English',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
};
const GITHUB_REPOSITORY = 'msfmsf777/karaoke-helper-v3';
const DISCORD_URL = 'https://discord.gg/96zfTcBgZG';
const README_URL = 'https://github.com/msfmsf777/karaoke-helper-v3?tab=readme-ov-file#%E7%99%BD%E8%8A%99%E5%A6%AE-k-%E6%AD%8C%E5%B0%8F%E5%B9%AB%E6%89%8B-v3-khelper';
const RELEASE_APPENDICES = {
  'zh-TW': {
    support: `**感謝大家支持 K歌小幫手！如果遇到更多 Bug 或有功能請求，歡迎前往 [DC 群組論壇](${DISCORD_URL}) 回報，我都會看到！**`,
    introduction: '簡介',
    tagline: '🔥主播歌回唯一需要的控制台 ( •̀ ω •́ )✧',
    platform: '⚠️ 目前僅在 Windows 10 / 11（64-bit）完成測試',
    download: '最新版下載連結',
    features: '核心功能',
    items: [
      '自建歌曲庫（本地檔案／線上歌曲下載）',
      '自建歌單',
      '線上歌曲搜尋與匯入',
      '高品質 AI 人聲分離',
      '滾動歌詞編輯器',
      '歌回實況模式',
      '變速與升降 Key',
      '統一控制歌單／歌詞',
      '自動日文輔助',
      '可自訂 OBS 歌詞／歌單疊圖',
    ],
    more: `查看全部功能與簡易教學，請前往【[傳送門](${README_URL})】`,
  },
  en: {
    support: `**Thank you for supporting KHelper! If you encounter bugs or have feature requests, please report them in the [Discord forum](${DISCORD_URL}); I will review them there.**`,
    introduction: 'About',
    tagline: '🔥The only command center a karaoke streamer needs ( •̀ ω •́ )✧',
    platform: '⚠️ Currently tested only on Windows 10 / 11 (64-bit)',
    download: 'Download the latest release',
    features: 'Core Features',
    items: [
      'Personal song library (local files / online downloads)',
      'Custom playlists',
      'Online song search and import',
      'High-quality AI vocal separation',
      'Scrolling lyrics editor',
      'Live karaoke stream mode',
      'Speed and key controls',
      'Unified setlist and lyrics control',
      'Automatic Japanese lyric assistance',
      'Customizable OBS lyrics and setlist overlays',
    ],
    more: `For all features and a quick guide, visit the 【[README portal](${README_URL})】.`,
  },
  'zh-CN': {
    support: `**感谢大家支持 K歌小帮手！如果遇到更多 Bug 或有功能请求，欢迎前往 [Discord 群组论坛](${DISCORD_URL}) 反馈，我都会看到！**`,
    introduction: '简介',
    tagline: '🔥主播歌回唯一需要的控制台 ( •̀ ω •́ )✧',
    platform: '⚠️ 目前仅在 Windows 10 / 11（64-bit）完成测试',
    download: '最新版下载链接',
    features: '核心功能',
    items: [
      '自建歌曲库（本地文件／在线歌曲下载）',
      '自建歌单',
      '在线歌曲搜索与导入',
      '高质量 AI 人声分离',
      '滚动歌词编辑器',
      '歌回直播模式',
      '变速与升降 Key',
      '统一控制歌单／歌词',
      '自动日文辅助',
      '可自定义 OBS 歌词／歌单叠图',
    ],
    more: `查看全部功能与简易教程，请前往【[传送门](${README_URL})】`,
  },
  ja: {
    support: `**KHelper を応援していただきありがとうございます！不具合や機能リクエストがありましたら、[Discord フォーラム](${DISCORD_URL}) へご報告ください。すべて確認します。**`,
    introduction: '概要',
    tagline: '🔥歌枠配信者に必要な、ただ一つのコントロールセンター ( •̀ ω •́ )✧',
    platform: '⚠️ 現在、Windows 10 / 11（64-bit）でのみ動作確認済みです',
    download: '最新版をダウンロード',
    features: '主な機能',
    items: [
      '自分専用の楽曲ライブラリ（ローカルファイル／オンラインダウンロード）',
      'カスタムプレイリスト',
      'オンライン楽曲の検索とインポート',
      '高品質 AI ボーカル分離',
      'スクロール歌詞エディター',
      '歌枠配信モード',
      '速度変更とキー調整',
      'セットリスト／歌詞の一括操作',
      '日本語歌詞の自動補助',
      'カスタマイズ可能な OBS 歌詞／セットリストオーバーレイ',
    ],
    more: `全機能と簡易ガイドは【[README ポータル](${README_URL})】をご覧ください。`,
  },
  ko: {
    support: `**KHelper를 응원해 주셔서 감사합니다! 버그나 기능 요청이 있으면 [Discord 포럼](${DISCORD_URL})에 남겨 주세요. 모두 확인하겠습니다.**`,
    introduction: '소개',
    tagline: '🔥노래 방송 스트리머에게 필요한 단 하나의 컨트롤 센터 ( •̀ ω •́ )✧',
    platform: '⚠️ 현재 Windows 10 / 11 (64-bit)에서만 테스트되었습니다',
    download: '최신 버전 다운로드',
    features: '핵심 기능',
    items: [
      '개인 곡 라이브러리 (로컬 파일 / 온라인 다운로드)',
      '사용자 지정 플레이리스트',
      '온라인 곡 검색 및 가져오기',
      '고품질 AI 보컬 분리',
      '스크롤 가사 편집기',
      '노래 방송 라이브 모드',
      '속도 및 키 조절',
      '세트리스트 / 가사 통합 제어',
      '자동 일본어 가사 보조',
      '사용자 지정 가능한 OBS 가사 / 세트리스트 오버레이',
    ],
    more: `전체 기능과 간단한 사용법은 【[README 포털](${README_URL})】에서 확인하세요.`,
  },
  id: {
    support: `**Terima kasih telah mendukung KHelper! Jika menemukan bug atau memiliki permintaan fitur, silakan laporkan di [forum Discord](${DISCORD_URL}); semua laporan akan saya lihat.**`,
    introduction: 'Tentang',
    tagline: '🔥Satu-satunya pusat kontrol yang dibutuhkan streamer karaoke ( •̀ ω •́ )✧',
    platform: '⚠️ Saat ini hanya diuji pada Windows 10 / 11 (64-bit)',
    download: 'Unduh rilis terbaru',
    features: 'Fitur Utama',
    items: [
      'Library lagu pribadi (file lokal / unduhan online)',
      'Playlist kustom',
      'Pencarian dan impor lagu online',
      'Pemisahan vokal AI berkualitas tinggi',
      'Editor lirik bergulir',
      'Mode live streaming karaoke',
      'Kontrol kecepatan dan nada',
      'Kontrol setlist dan lirik terpadu',
      'Bantuan lirik bahasa Jepang otomatis',
      'Overlay lirik dan setlist OBS yang dapat dikustomisasi',
    ],
    more: `Untuk semua fitur dan panduan singkat, buka 【[portal README](${README_URL})】.`,
  },
  th: {
    support: `**ขอบคุณที่สนับสนุน KHelper! หากพบ Bug หรือต้องการเสนอฟีเจอร์ กรุณาแจ้งใน [ฟอรัม Discord](${DISCORD_URL}) ฉันจะตรวจสอบทุกข้อความ**`,
    introduction: 'แนะนำ',
    tagline: '🔥ศูนย์ควบคุมเดียวที่สตรีมเมอร์คาราโอเกะต้องมี ( •̀ ω •́ )✧',
    platform: '⚠️ ปัจจุบันทดสอบแล้วเฉพาะบน Windows 10 / 11 (64-bit)',
    download: 'ดาวน์โหลดเวอร์ชันล่าสุด',
    features: 'ฟีเจอร์หลัก',
    items: [
      'คลังเพลงส่วนตัว (ไฟล์ในเครื่อง / ดาวน์โหลดออนไลน์)',
      'เพลย์ลิสต์แบบกำหนดเอง',
      'ค้นหาและนำเข้าเพลงออนไลน์',
      'แยกเสียงร้องด้วย AI คุณภาพสูง',
      'ตัวแก้ไขเนื้อเพลงแบบเลื่อน',
      'โหมดสตรีมคาราโอเกะสด',
      'ควบคุมความเร็วและคีย์',
      'ควบคุมเซ็ตลิสต์ / เนื้อเพลงในที่เดียว',
      'ตัวช่วยเนื้อเพลงภาษาญี่ปุ่นอัตโนมัติ',
      'OBS overlay สำหรับเนื้อเพลง / เซ็ตลิสต์ที่ปรับแต่งได้',
    ],
    more: `ดูฟีเจอร์ทั้งหมดและคู่มือฉบับย่อได้ที่ 【[พอร์ทัล README](${README_URL})】`,
  },
};

const rootDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = process.argv[2] || packageJson.version;
const sourcePath = path.join(rootDir, 'release-notes', `v${version}.json`);
const outputDir = path.join(rootDir, 'release', version);

if (!fs.existsSync(sourcePath)) {
  fail(`Missing release notes source: ${path.relative(rootDir, sourcePath)}`);
}

const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
validateCatalog(catalog, version);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'release-notes.json'), `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'GITHUB_RELEASE_BODY.md'), renderGithubBody(catalog));

console.log(`Generated localized release notes for v${version}`);

function validateCatalog(catalog, expectedVersion) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') {
    errors.push('catalog must be an object');
  }
  if (catalog.version !== expectedVersion) {
    errors.push(`catalog.version must be "${expectedVersion}"`);
  }
  if (!catalog.locales || typeof catalog.locales !== 'object') {
    errors.push('catalog.locales must be an object');
  } else {
    for (const locale of REQUIRED_LOCALES) {
      const notes = catalog.locales[locale];
      if (!notes) {
        errors.push(`missing locale: ${locale}`);
        continue;
      }
      if (!notes.title || typeof notes.title !== 'string') errors.push(`${locale}.title is required`);
      if (notes.summary !== undefined && typeof notes.summary !== 'string') errors.push(`${locale}.summary must be a string`);
      if (!Array.isArray(notes.sections) || notes.sections.length === 0) {
        errors.push(`${locale}.sections must be a non-empty array`);
      } else {
        notes.sections.forEach((section, index) => {
          if (!section.title || typeof section.title !== 'string') errors.push(`${locale}.sections[${index}].title is required`);
          if (section.body !== undefined && typeof section.body !== 'string') errors.push(`${locale}.sections[${index}].body must be a string`);
          if (section.items !== undefined && (!Array.isArray(section.items) || section.items.some((item) => typeof item !== 'string'))) {
            errors.push(`${locale}.sections[${index}].items must be an array of strings`);
          }
          if (section.body === undefined && section.items === undefined) {
            errors.push(`${locale}.sections[${index}] must include body or items`);
          }
        });
      }
    }
  }

  if (errors.length > 0) {
    fail(errors.join('\n'));
  }
}

function renderGithubBody(catalog) {
  const parts = [`# KHelper V${catalog.version}`, ''];

  for (const locale of DISPLAY_ORDER) {
    const notes = catalog.locales[locale];
    if (!notes) continue;

    const body = [renderLocale(notes), renderReleaseAppendix(locale, catalog.version)].join('\n\n');
    if (locale === 'zh-TW' || locale === 'en') {
      parts.push(`## ${LOCALE_LABELS[locale]}`, '', body, '');
      continue;
    }

    parts.push(
      `<details>`,
      `<summary>${LOCALE_LABELS[locale]}</summary>`,
      '',
      body,
      '',
      `</details>`,
      '',
    );
  }

  return `${parts.join('\n').trim()}\n`;
}

function renderLocale(notes) {
  const lines = [`### ${notes.title}`];
  if (notes.summary) {
    lines.push('', notes.summary);
  }

  for (const section of notes.sections) {
    lines.push('', `#### ${section.title}`);
    if (section.body) {
      lines.push('', section.body);
    }
    if (section.items) {
      lines.push('', ...section.items.map((item) => `- ${item}`));
    }
  }

  return lines.join('\n');
}

function renderReleaseAppendix(locale, version) {
  const copy = RELEASE_APPENDICES[locale];
  const installerName = `KHelperV3-Setup-${version}.exe`;
  const downloadUrl = `https://github.com/${GITHUB_REPOSITORY}/releases/download/v${version}/${installerName}`;
  return [
    copy.support,
    '',
    '---',
    '',
    `### ${copy.introduction}`,
    '',
    copy.tagline,
    '',
    `> ${copy.platform}`,
    '',
    `【[${copy.download}](${downloadUrl})】`,
    '',
    `#### ${copy.features}`,
    '',
    ...copy.items.map((item) => `✅${item}`),
    '',
    copy.more,
  ].join('\n');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
