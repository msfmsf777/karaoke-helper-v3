import sys
import os
import json
import argparse
import shutil
from pathlib import Path
import io

# 1. Patch torchaudio to use soundfile directly
# This bypasses torchaudio.save's dependency on TorchCodec
try:
    import torchaudio
    import soundfile
    import torch

    def _custom_save(filepath, src, sample_rate, **kwargs):
        # src is shape (channels, frames)
        # soundfile expects (frames, channels)
        if src.dim() == 2:
            src = src.t()
        
        # Convert to numpy
        src_np = src.detach().cpu().numpy()
        
        # soundfile.write(file, data, samplerate)
        soundfile.write(filepath, src_np, sample_rate)

    torchaudio.save = _custom_save
    
    # Also patch save_audio in demucs if possible, but patching torchaudio.save is usually enough
    # as demucs calls torchaudio.save directly.
except ImportError:
    pass

# 2. Import Demucs
try:
    from demucs import separate
except ImportError:
    print(json.dumps({"error": "Demucs not installed or not found"}))
    sys.exit(1)

class ProgressCapture(io.TextIOBase):
    def __init__(self, original_stderr):
        self.original_stderr = original_stderr
        self.buffer = []
        self.last_lines = []
        import re
        self.progress_pattern = re.compile(r'\s*(\d+)%\|')

    def write(self, data):
        # Pass through to real stderr (so Electron can see it if needed)
        self.original_stderr.write(data)
        
        # Keep last 20 lines for error reporting
        if '\n' in data:
            lines = data.split('\n')
            for line in lines:
                if line:
                    self.last_lines.append(line)
            if len(self.last_lines) > 20:
                self.last_lines = self.last_lines[-20:]
        else:
            if data:
                self.last_lines.append(data)

        # Parse progress
        match = self.progress_pattern.search(data)
        if match:
            try:
                p = int(match.group(1))
                print(json.dumps({"status": "progress", "progress": p}))
                sys.stdout.flush()
            except:
                pass

    def flush(self):
        self.original_stderr.flush()

def main():
    parser = argparse.ArgumentParser(description='Run Demucs separation')
    parser.add_argument('--input', required=True, help='Input audio file path')
    parser.add_argument('--output-dir', required=True, help='Output directory for stems')
    parser.add_argument('--model', default='htdemucs_ft', help='Demucs model to use')
    parser.add_argument('--cache-dir', help='Directory to cache models')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {input_path}"}))
        sys.exit(1)
        
    if not output_dir.exists():
        os.makedirs(output_dir, exist_ok=True)

    # Set TORCH_HOME for model caching
    if args.cache_dir:
        os.environ['TORCH_HOME'] = args.cache_dir
        os.environ['XDG_CACHE_HOME'] = args.cache_dir # Demucs might use this too

    print(json.dumps({"status": "starting", "message": f"Starting separation for {input_path.name}"}))
    sys.stdout.flush()

    # Capture stderr
    original_stderr = sys.stderr
    progress_capture = ProgressCapture(original_stderr)
    sys.stderr = progress_capture

    # Prepare arguments for Demucs
    # Demucs uses argparse, so we mock sys.argv
    # We use -n to specify model, -o to specify output base
    # --two-stems=vocals forces 2 stems: vocals and no_vocals (instrumental)
    sys.argv = [
        "demucs",
        "-n", args.model,
        "--two-stems", "vocals",
        "-o", str(output_dir),
        str(input_path)
    ]

    try:
        separate.main()
    except SystemExit as e:
        if e.code != 0:
            error_details = "\n".join(progress_capture.last_lines)
            print(json.dumps({"error": "Demucs failed", "code": e.code, "details": error_details}))
            sys.exit(e.code)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(json.dumps({"error": "Demucs exception", "details": error_details}))
        sys.exit(1)
    finally:
        sys.stderr = original_stderr

    # Post-processing: Move files
    # Demucs output structure: <output_dir>/<model_name>/<song_name>/...
    
    model_dir = output_dir / args.model
    song_dir = model_dir / input_path.stem
    
    if not song_dir.exists():
        # Fallback search
        subdirs = [d for d in model_dir.iterdir() if d.is_dir()]
        if len(subdirs) == 1:
            song_dir = subdirs[0]
        else:
            print(json.dumps({"error": "Could not locate Demucs output folder", "search_path": str(model_dir)}))
            sys.exit(1)

    src_vocals = song_dir / "vocals.wav"
    src_instrumental = song_dir / "no_vocals.wav"
    
    if not src_vocals.exists() or not src_instrumental.exists():
        print(json.dumps({"error": "Output stems missing", "path": str(song_dir)}))
        sys.exit(1)
        
    dest_vocals = output_dir / "Vocals.wav"
    dest_instrumental = output_dir / "Instrumental.wav"
    
    # Remove existing
    if dest_vocals.exists(): dest_vocals.unlink()
    if dest_instrumental.exists(): dest_instrumental.unlink()

    shutil.move(str(src_vocals), str(dest_vocals))
    shutil.move(str(src_instrumental), str(dest_instrumental))
    
    # Cleanup
    try:
        shutil.rmtree(str(model_dir))
    except:
        pass

    print(json.dumps({
        "status": "success",
        "instrumental": str(dest_instrumental),
        "vocal": str(dest_vocals)
    }))

if __name__ == "__main__":
    main()
