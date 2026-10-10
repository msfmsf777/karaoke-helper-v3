import sys
import os
import json

# Ensure resources/lyrics is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def is_cjk_char(ch):
    c = ord(ch)
    return (0x4E00 <= c <= 0x9FFF) or (0x3400 <= c <= 0x4DBF)

def process_zh(lines):
    import pypinyin
    results = []

    for line_obj in lines:
        text = line_obj.get('text', '')
        if not text:
            results.append({
                'original': '',
                'romaji': '',
                'ruby': []
            })
            continue

        py_list = pypinyin.pinyin(text, style=pypinyin.Style.TONE)
        segments = []
        idx = 0

        for item in py_list:
            py_val = item[0]
            if idx >= len(text):
                break

            if is_cjk_char(text[idx]):
                segments.append({
                    'surface': text[idx],
                    'furigana': py_val
                })
                idx += 1
            else:
                chunk_len = len(py_val)
                segments.append({
                    'surface': text[idx:idx + chunk_len],
                    'furigana': None
                })
                idx += chunk_len

        if idx < len(text):
            segments.append({
                'surface': text[idx:],
                'furigana': None
            })

        results.append({
            'original': text,
            'romaji': '',
            'ruby': segments
        })

    return results

def process_ko(lines):
    from korean_romanizer import Romanizer
    results = []

    for line_obj in lines:
        text = line_obj.get('text', '')
        if not text:
            results.append({
                'original': '',
                'romaji': '',
                'ruby': []
            })
            continue

        try:
            romaji_text = Romanizer(text).romanize()
        except Exception:
            romaji_text = text

        results.append({
            'original': text,
            'romaji': romaji_text,
            'ruby': [{
                'surface': text,
                'furigana': None
            }]
        })

    return results

def process_ja(lines):
    import jp_furigana
    return jp_furigana.process_lyrics(lines)

def process_cjk(data):
    if isinstance(data, list):
        # Legacy list input, default to Japanese
        return process_ja(data)

    lang = data.get('lang', 'ja')
    lines = data.get('lines', [])

    if lang == 'zh':
        return process_zh(lines)
    elif lang == 'ko':
        return process_ko(lines)
    else:
        return process_ja(lines)

if __name__ == '__main__':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')

    try:
        input_str = sys.stdin.read()
        if not input_str:
            sys.exit(0)

        data = json.loads(input_str)
        result = process_cjk(data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
