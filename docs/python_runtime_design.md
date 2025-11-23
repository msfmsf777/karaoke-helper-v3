# Private Python Runtime Design

## Overview
To ensure a consistent and reliable experience for audio separation features in KHelperLive, we are moving from using the system-installed Python to a bundled, private Python runtime. This allows us to control the exact version of Python and the installed packages, avoiding conflicts with the user's system environment.

## Strategy
We will use the **Windows Embeddable Package (64-bit)** for Python. This is a minimal Python distribution that can be unzipped and run without installation.

### Directory Layout
The runtime will be located in `resources/python-runtime/`.
The structure will be:
```
resources/python-runtime/
  ├── python.exe
  ├── python310.zip (or similar)
  ├── Lib/
  ├── Scripts/
  └── ...
```

### Package Management
We will install `pip` into this runtime to allow installing packages from `requirements.txt`.
Packages will be installed into `resources/python-runtime/Lib/site-packages`.

### Integration with Electron
The Electron app will resolve the Python executable path in the following order:
1.  **Environment Variable**: `KHELPER_PYTHON_RUNTIME_PATH` (useful for development).
2.  **Bundled Runtime**: `resources/python-runtime/python.exe` (relative to the app executable or project root in dev).

### License & Redistribution
Python is open source (PSF License), which allows bundling and redistribution. We must ensure we include the license file if required, but generally, the embeddable zip is designed for this purpose.

## Model Management
MDX models will no longer be bundled. They will be downloaded on demand to `%APPDATA%/KHelperLive/models/mdx/`.
This reduces the installer size and allows updating models without updating the app.
