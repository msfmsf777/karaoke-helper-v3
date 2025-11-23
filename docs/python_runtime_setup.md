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

## Step 4: Install Requirements
Now install the required packages for separation.

1.  In the terminal (still in `resources/python-runtime/`), run:
    ```powershell
    .\python.exe -m pip install -r ..\separation\requirements.txt
    ```
    (Adjust the path to `requirements.txt` if necessary. It is located in `resources/separation/requirements.txt`).

## Step 5: Verify Setup
1.  Run the separation script help command to verify everything is working:
    ```powershell
    .\python.exe ..\separation\separate.py --help
    ```
    You should see the help output for the separation script.

## Development Usage
When running KHelperLive in development mode (`npm run dev`), the app will automatically look for `resources/python-runtime/python.exe`.

If you want to use a different Python environment (not recommended for testing the private runtime integration), you can set the environment variable `KHELPER_PYTHON_RUNTIME_PATH` to the full path of your python executable.

## Updating Packages
To update packages, simply run the pip install command again with the updated `requirements.txt` or specific package names.
```powershell
.\python.exe -m pip install -U some-package
```
