# Private Python Runtime Setup Guide

This guide explains how to set up the private Python runtime for KHelperLive development.

## Prerequisites
- Windows OS (Primary target)
- Internet connection

## Step 1: Download Python Embeddable Package
1.  Go to the [Python Downloads for Windows](https://www.python.org/downloads/windows/) page.
2.  Download the **Windows embeddable package (64-bit)** for Python 3.10.x (or the version you wish to use, e.g., 3.10.11).
    - Direct link example: [python-3.10.11-embed-amd64.zip](https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip)

## Step 2: Create Runtime Directory
1.  Navigate to the `resources` folder in the KHelperLive project root.
2.  Create a new folder named `python-runtime`.
3.  Extract the contents of the downloaded zip file into `resources/python-runtime/`.

Your structure should look like this:
```
KHelperLive/
  resources/
    python-runtime/
      python.exe
      python310.zip
      ...
```

## Step 3: Enable Pip and Site-Packages
The embeddable package is minimal and doesn't include `pip` by default. It also ignores `site-packages` unless configured.

1.  **Enable site-packages**:
    - Open `resources/python-runtime/python310._pth` (the name depends on the version) in a text editor.
    - Uncomment the line `import site` (remove the `#`).
    - Save the file.

2.  **Install Pip**:
    - Download `get-pip.py`: [https://bootstrap.pypa.io/get-pip.py](https://bootstrap.pypa.io/get-pip.py)
    - Save it somewhere (e.g., in `resources/python-runtime/`).
    - Open a terminal in `resources/python-runtime/`.
    - Run: `.\python.exe get-pip.py`
    - This will install `pip`, `setuptools`, and `wheel`.

## Step 4: Install Base Requirements
Now install the base required packages (Japanese lyric processing):

1.  In the terminal (still in `resources/python-runtime/`), run:
    ```powershell
    .\python.exe -m pip install -r ..\requirements.txt
    ```

> [!NOTE]
> **Audio Separation Packages (`audio-separator`, `torch`, etc.)**
> Starting in v3.4+, heavy ML packages (PyTorch, ONNXRuntime, CUDA/CPU wheels) are **no longer bundled in the installer**.
> Instead, they are installed dynamically on first separation use directly into user data:
> `%APPDATA%\com.khelper.v3\separation-runtime`
> This keeps the installer download slim (~120 MB), enables hardware-detected NVIDIA CUDA acceleration, and eliminates Windows UAC administrator privilege issues.

## Step 5: Verify Setup
1.  Verify the base Japanese furigana script:
    ```powershell
    .\python.exe ..\lyrics\jp_furigana.py --help
    ```

2.  For separation, you can let the KHelper app install the runtime via the UI, or manually test install:
    ```powershell
    .\python.exe -m pip install --prefix "%APPDATA%\com.khelper.v3\separation-runtime" "audio-separator[cpu]"
    ```

## Development Usage
When running KHelperLive in development mode (`npm run dev`), the app will automatically look for `resources/python-runtime/python.exe`.

If you want to use a different Python environment, you can set the environment variable `KHELPER_PYTHON_RUNTIME_PATH` to the full path of your python executable.
