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

# Support dynamically installed separation packages (e.g. in %APPDATA%/.../separation-runtime)
import site
packages_dir = os.environ.get('KHELPER_SEPARATION_PACKAGES')
if packages_dir and os.path.exists(packages_dir):
    site.addsitedir(packages_dir)
    torch_lib = os.path.join(packages_dir, 'torch', 'lib')
    if os.path.exists(torch_lib):
        if hasattr(os, 'add_dll_directory'):
            try:
                os.add_dll_directory(torch_lib)
            except Exception:
                pass
        # Prepend torch/lib to PATH so C++ DLLs (like onnxruntime_providers_cuda.dll)
        # can dynamically resolve cublasLt64_12.dll, cudart64_12.dll, cudnn64_9.dll etc.
        os.environ['PATH'] = torch_lib + os.pathsep + os.environ.get('PATH', '')

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
    parser.add_argument('--quality', default='normal', choices=['high', 'normal', 'fast'], help='Separation quality preset')
    parser.add_argument('--output-format', default='wav', help='Output format (wav, mp3, m4a, etc)')
    parser.add_argument('--bitrate', default='320k', help='Bitrate for encoded output (e.g. 320k)')
    parser.add_argument('--model-override', help='Override model filename directly')
    parser.add_argument('--model-dir', help='Directory containing model files')
    parser.add_argument('--device', default=None, choices=['cuda', 'cpu', 'auto'], help='Hardware acceleration device (cuda/cpu/auto)')
    
    args = parser.parse_args()

    # Determine execution device mode
    device_mode = args.device or os.environ.get('KHELPER_SEPARATION_MODE', 'auto')
    if device_mode == 'gpu':
        device_mode = 'cuda'

    if device_mode == 'cpu':
        # Enforce CPU mode strictly when requested
        os.environ['CUDA_VISIBLE_DEVICES'] = ''
    
    # Model Mapping
    # Must match MODEL_PRESETS in modelManager.ts
    model_map = {
        'high': 'MDX23C-8KFFT-InstVoc_HQ.ckpt',
        'normal': 'UVR-MDX-NET-Inst_HQ_3.onnx',
        'fast': 'UVR-MDX-NET-Inst_1.onnx'
    }
    
    model_filename = args.model_override if args.model_override else model_map.get(args.quality, 'UVR-MDX-NET-Inst_HQ_3.onnx')

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {input_path}"}))
        sys.exit(1)
        
    if not output_dir.exists():
        os.makedirs(output_dir, exist_ok=True)

    # Initialize Progress Tracker
    tracker = ProgressTracker()
    
    # Capture stderr
    original_stderr = sys.stderr
    sys.stderr = ProgressCapture(original_stderr, tracker)

    print(json.dumps({"status": "starting", "message": f"Starting MDX separation ({args.quality}) for {input_path.name}"}))
    sys.stdout.flush()

    try:
        from audio_separator.separator import Separator
    except ImportError:
        print(json.dumps({"error": "audio-separator not installed"}))
        sys.exit(1)

    def run_pipeline(force_cpu=False):
        if force_cpu:
            os.environ['CUDA_VISIBLE_DEVICES'] = ''

        # Phase 1: Initialization & Model Loading (0-10%)
        tracker.set_phase("loading_model", 0, 10)
        
        sep = Separator(
            log_level=logging.WARNING,
            model_file_dir=args.model_dir,
            output_dir=str(output_dir),
            output_format=args.output_format,
            output_bitrate=args.bitrate
        )

        if force_cpu:
            try:
                import torch
                sep.torch_device = torch.device('cpu')
                sep.onnx_execution_provider = ['CPUExecutionProvider']
            except Exception:
                pass

        # Emit device info for Electron logging & diagnostics
        active_device = str(getattr(sep, 'torch_device', 'unknown'))
        active_providers = getattr(sep, 'onnx_execution_provider', [])
        active_provider = active_providers[0] if active_providers else 'unknown'
        cuda_avail = False
        gpu_name = None
        try:
            import torch
            cuda_avail = torch.cuda.is_available() and not force_cpu
            if cuda_avail:
                gpu_name = torch.cuda.get_device_name(0)
        except Exception:
            pass

        print(json.dumps({
            "status": "device_info",
            "requested_device": "cpu" if force_cpu else device_mode,
            "torch_device": active_device,
            "onnx_provider": active_provider,
            "cuda_available": cuda_avail,
            "gpu_name": gpu_name
        }))
        sys.stdout.flush()

        print(json.dumps({"status": "loading_model", "model": model_filename}))
        sys.stdout.flush()
        
        sep.load_model(model_filename=model_filename)

        # Phase 2: Separation (10-95%)
        tracker.set_phase("separating", 10, 95)
        
        print(json.dumps({"status": "separating"}))
        sys.stdout.flush()
        
        files = sep.separate(str(input_path))
        return sep, files

    try:
        separator = None
        output_files = None
        is_cpu_mode = (device_mode == 'cpu')

        try:
            separator, output_files = run_pipeline(force_cpu=is_cpu_mode)
        except Exception as first_err:
            if not is_cpu_mode:
                err_msg = str(first_err)
                print(json.dumps({
                    "status": "warning",
                    "code": "GPU_FALLBACK_TO_CPU",
                    "reason": err_msg,
                    "message": f"GPU 加速執行失敗 ({err_msg[:60]}...)，已自動降級至 CPU 模式繼續處理。"
                }))
                sys.stdout.flush()

                # Cleanup GPU resources before fallback
                try:
                    del separator
                except Exception:
                    pass
                try:
                    import gc
                    gc.collect()
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass

                separator, output_files = run_pipeline(force_cpu=True)
            else:
                raise first_err

        # Phase 3: Finalizing (95-100%)
        tracker.set_phase("finalizing", 95, 100)
        
        ext = f".{args.output_format}"
        dest_vocals = output_dir / f"Vocals{ext}"
        dest_instrumental = output_dir / f"Instrumental{ext}"
        
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
                pass

        if not renamed_vocal or not renamed_instr:
             print(json.dumps({"error": "Failed to identify output stems", "files": output_files}))
             sys.exit(1)

        tracker.update_from_tqdm(100) 
        
        print(json.dumps({
            "status": "success",
            "instrumental": str(dest_instrumental),
            "vocal": str(dest_vocals)
        }))

    except Exception as e:
        import traceback
        sys.stderr = original_stderr 
        print(json.dumps({"error": "MDX separation failed", "details": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
