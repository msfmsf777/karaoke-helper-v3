import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';

/**
 * Resolves the path to the Python executable.
 * Priority:
 * 1. KHELPER_PYTHON_RUNTIME_PATH environment variable
 * 2. Bundled runtime in resources/python-runtime/python.exe
 */
export async function getPythonPath(): Promise<string> {
    // 1. Environment variable override
    if (process.env.KHELPER_PYTHON_RUNTIME_PATH) {
        return process.env.KHELPER_PYTHON_RUNTIME_PATH;
    }

    // 2. Bundled runtime
    // In production (packaged), resources is at process.resourcesPath
    // In development, it's at the project root resources
    let runtimeBase: string;
    if (app.isPackaged) {
        runtimeBase = path.join(process.resourcesPath, 'python-runtime');
    } else {
        runtimeBase = path.join(process.cwd(), 'resources', 'python-runtime');
    }

    const pythonPath = path.join(runtimeBase, 'python.exe');

    try {
        await fs.access(pythonPath);
        return pythonPath;
    } catch {
        // If strictly required, we might want to throw here, but for now let's return it 
        // and let the caller fail when trying to spawn, or fallback to system python if we wanted (but we don't want that anymore).
        console.warn(`[PythonRuntime] Bundled Python not found at ${pythonPath}`);
        return pythonPath;
    }
}
