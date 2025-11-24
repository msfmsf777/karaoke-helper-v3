import sys
import json
import fugashi
import cutlet

def process_lyrics(input_data):
    tagger = fugashi.Tagger()
    katsu = cutlet.Cutlet()
    katsu.use_foreign_spelling = False 
    
    results = []
    
    for line_obj in input_data:
        text = line_obj.get('text', '')
        
        # 1. Generate Romaji for the whole line
        romaji = katsu.romaji(text)
        
        # 2. Generate Furigana (Ruby) structure
        # We want to break the text into segments.
        # Each segment is either:
        # - Pure Kana/Punctuation (no furigana needed)
        # - Kanji/Mixed that needs furigana
        
        ruby_segments = []
        
        # Fugashi tokenization
        # We need to reconstruct the original text from tokens while attaching readings
        # Note: fugashi/mecab might split things finely.
        
        for word in tagger(text):
            surface = word.surface
            feature = word.feature
            
            # feature is a named tuple or object in fugashi, but printing it gives the CSV string
            # standard unidic format:
            # pos1, pos2, pos3, pos4, cType, cForm, lForm, lemma, orth, pron, orthBase, pronBase, goshu, iType, iForm, fType, fForm
            # We mainly care about 'surface' and the reading.
            # Unidic-lite usually provides reading in katakana.
            
            # Check if the word contains Kanji. If not, no furigana needed usually.
            # Simple heuristic: if surface equals reading (converted to katakana), no furigana.
            # But we need the reading first.
            
            # feature.kana is often available in unidic
            reading = word.feature.kana
            
            # If no reading provided (e.g. symbols), use surface
            if not reading:
                ruby_segments.append({'surface': surface, 'furigana': None})
                continue
                
            # Convert reading (Katakana) to Hiragana for display
            reading_hira = jaconv_kata2hira(reading)
            surface_hira = jaconv_kata2hira(surface) # Just in case surface is katakana
            
            # If surface is already same as reading (e.g. "わたし" -> "ワタシ"), no furigana
            # Also if surface is purely kana, usually no furigana needed unless it's a difficult word, 
            # but standard practice is only for Kanji.
            if has_kanji(surface):
                 ruby_segments.append({'surface': surface, 'furigana': reading_hira})
            else:
                 ruby_segments.append({'surface': surface, 'furigana': None})

        results.append({
            'original': text,
            'romaji': romaji,
            'ruby': ruby_segments
        })
        
    return results

def has_kanji(text):
    return any('\u4e00' <= char <= '\u9faf' for char in text)

def jaconv_kata2hira(text):
    # Simple Katakana -> Hiragana conversion
    # Offset is -0x60 (96)
    res = []
    for char in text:
        code = ord(char)
        if 0x30A1 <= code <= 0x30F6:
            res.append(chr(code - 0x60))
        else:
            res.append(char)
    return "".join(res)

if __name__ == "__main__":
    # Set stdin/stdout to utf-8
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    
    try:
        input_str = sys.stdin.read()
        if not input_str:
            sys.exit(0)
            
        data = json.loads(input_str)
        result = process_lyrics(data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        # Output error as JSON
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
