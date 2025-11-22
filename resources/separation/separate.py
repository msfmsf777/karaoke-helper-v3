import sys
import os
import json
import argparse
import shutil
import logging
import io
import re
import threading
from pathlib import Path

# Configure logging
# audio-separator uses logging.INFO for some updates, but tqdm prints to stderr.
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class ProgressTracker:
    def __init__(self):
        self.current_progress = 0
        self.phase_offset = 0
        self.phase_scale = 1.0
        self.lock = threading.Lock()

    def set_phase(self, name, start_percent, end_percent):
        with self.lock:
            # Ensure we don't go backwards even when switching phases
            self.current_progress = max(self.current_progress, start_percent)
            self.phase_offset = start_percent
            self.phase_scale = (end_percent - start_percent) / 100.0
            print(json.dumps({"status": "phase", "phase": name, "progress": self.current_progress}))
            sys.stdout.flush()

    def update_from_tqdm(self, percent):
        with self.lock:
            # Calculate absolute progress based on current phase
            abs_progress = self.phase_offset + (percent * self.phase_scale)
            
            # Monotonic check: never go backwards
            if abs_progress > self.current_progress:
                self.current_progress = abs_progress
                # Report integer progress to Electron
                print(json.dumps({"status": "progress", "progress": int(self.current_progress)}))
                sys.stdout.flush()

class ProgressCapture(io.TextIOBase):
    def __init__(self, original_stderr, tracker):
        self.original_stderr = original_stderr
        self.tracker = tracker
        self.buffer = ""
        # tqdm pattern: " 10%|" or "100%|"
        self.progress_pattern = re.compile(r'\s*(\d+)%\|')

    def write(self, data):
        # Pass through to real stderr
        self.original_stderr.write(data)
        self.original_stderr.flush()

        # Buffer handling for split chunks
        self.buffer += data
        while '\n' in self.buffer or '\r' in self.buffer:
            if '\n' in self.buffer:
                line, self.buffer = self.buffer.split('\n', 1)
            else:
                line, self.buffer = self.buffer.split('\r', 1)
            
            self._parse_line(line)
        
        # Also try to parse current buffer if it looks like a progress bar update (often ends with \r)
        if '%' in self.buffer:
             self._parse_line(self.buffer)

    def _parse_line(self, line):
        match = self.progress_pattern.search(line)
        if match:
            try:
                p = int(match.group(1))
                self.tracker.update_from_tqdm(p)
            except:
                pass

    def flush(self):
        self.original_stderr.flush()

def main():
    parser = argparse.ArgumentParser(description='Run MDX separation')
    parser.add_argument('--input', required=True, help='Input audio file path')
    parser.add_argument('--output-dir', required=True, help='Output directory for stems')
    parser.add_argument('--model', default='UVR-MDX-NET-Inst_HQ_3.onnx', help='MDX model to use')
    parser.add_argument('--cache-dir', help='Directory to cache models')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {input_path}"}))
        sys.exit(1)
        
    if not output_dir.exists():
        os.makedirs(output_dir, exist_ok=True)

    if args.cache_dir:
        os.environ['AUDIO_SEPARATOR_CACHE_DIR'] = args.cache_dir

    # Initialize Progress Tracker
    tracker = ProgressTracker()
    
    # Capture stderr
    original_stderr = sys.stderr
    sys.stderr = ProgressCapture(original_stderr, tracker)

    print(json.dumps({"status": "starting", "message": f"Starting MDX separation for {input_path.name}"}))
    sys.stdout.flush()

    try:
        from audio_separator.separator import Separator
    except ImportError:
        print(json.dumps({"error": "audio-separator not installed"}))
        sys.exit(1)

    try:
        # Phase 1: Initialization & Model Loading (0-10%)
        tracker.set_phase("loading_model", 0, 10)
        
        separator = Separator(
            log_level=logging.WARNING,
            model_file_dir=args.cache_dir if args.cache_dir else None,
            output_dir=str(output_dir),
            output_format="wav"
        )

        print(json.dumps({"status": "loading_model", "model": args.model}))
        sys.stdout.flush()
        
        separator.load_model(model_filename=args.model)

        # Phase 2: Separation (10-95%)
        # We assume separation is the bulk of the work.
        tracker.set_phase("separating", 10, 95)
        
        print(json.dumps({"status": "separating"}))
        sys.stdout.flush()
        
        # This call will trigger tqdm output to stderr, which ProgressCapture will parse
        output_files = separator.separate(str(input_path))
        
        # Phase 3: Finalizing (95-100%)
        tracker.set_phase("finalizing", 95, 100)
        
        dest_vocals = output_dir / "Vocals.wav"
        dest_instrumental = output_dir / "Instrumental.wav"
        
        if dest_vocals.exists(): dest_vocals.unlink()
        if dest_instrumental.exists(): dest_instrumental.unlink()
        
        renamed_vocal = False
        renamed_instr = False

        for fname in output_files:
            fpath = output_dir / fname
            lower_name = fname.lower()
            
            if "vocals" in lower_name:
                shutil.move(str(fpath), str(dest_vocals))
                renamed_vocal = True
            elif "instrumental" in lower_name:
                shutil.move(str(fpath), str(dest_instrumental))
                renamed_instr = True
            else:
                # If we have other stems or unknown names, we might need smarter logic
                # For now, just log it
                pass

        if not renamed_vocal or not renamed_instr:
             # Fallback: if we only got 2 files and couldn't identify by name, 
             # maybe assume order? (Risky). 
             # Let's fail for now to be safe.
             print(json.dumps({"error": "Failed to identify output stems", "files": output_files}))
             sys.exit(1)

        tracker.update_from_tqdm(100) # Force 100%
        
        print(json.dumps({
            "status": "success",
            "instrumental": str(dest_instrumental),
            "vocal": str(dest_vocals)
        }))

    except Exception as e:
        import traceback
        # Restore stderr to print traceback cleanly if needed, or just send JSON
        sys.stderr = original_stderr 
        print(json.dumps({"error": "MDX separation failed", "details": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
