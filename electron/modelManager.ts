import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// Define model presets
export const MODEL_PRESETS = {
    high: {
        filename: 'MDX23C-8KFFT-InstVoc_HQ.ckpt',
        url: 'https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/MDX23C-8KFFT-InstVoc_HQ.ckpt',
        name: 'MDX23C-InstVocHQ'
    },
    normal: {
        filename: 'UVR-MDX-NET-Inst_HQ_3.onnx',
        url: 'https://huggingface.co/seanghay/uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_3.onnx',
        name: 'UVR-MDX-NET-Inst_HQ_3'
    },
    fast: {
        filename: 'UVR-MDX-NET-Inst_1.onnx',
        url: 'https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/UVR-MDX-NET-Inst_1.onnx',
        name: 'UVR-MDX-NET-Inst_1'
    }
};

export type QualityPreset = keyof typeof MODEL_PRESETS;

export function getModelCacheDir(): string {
    return path.join(app.getPath('userData'), 'models', 'mdx');
}

export async function getModelPath(quality: QualityPreset): Promise<string> {
    const cacheDir = getModelCacheDir();
    return path.join(cacheDir, MODEL_PRESETS[quality].filename);
}

export async function isModelAvailable(quality: QualityPreset): Promise<boolean> {
    const modelPath = await getModelPath(quality);
    try {
        await fs.access(modelPath);
        return true;
    } catch {
        return false;
    }
}

export async function downloadModel(
    quality: QualityPreset,
    onProgress?: (percent: number) => void
): Promise<string> {
    const preset = MODEL_PRESETS[quality];
    const cacheDir = getModelCacheDir();
    const finalPath = path.join(cacheDir, preset.filename);
    const tempPath = path.join(cacheDir, `${preset.filename}.tmp`);

    await fs.mkdir(cacheDir, { recursive: true });

    console.log(`[ModelManager] Downloading ${preset.name} from ${preset.url}`);

    try {
        const response = await fetch(preset.url);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.statusText}`);
        }

        const totalLength = Number(response.headers.get('content-length'));
        let downloaded = 0;

        if (!response.body) throw new Error('No response body');

        const fileStream = createWriteStream(tempPath);
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            downloaded += value.length;
            fileStream.write(value);

            if (totalLength && onProgress) {
                onProgress((downloaded / totalLength) * 100);
            }
        }

        fileStream.end();

        // Wait for stream to finish
        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        await fs.rename(tempPath, finalPath);
        console.log(`[ModelManager] Download complete: ${finalPath}`);
        return finalPath;

    } catch (err) {
        console.error(`[ModelManager] Download failed`, err);
        try {
            await fs.unlink(tempPath);
        } catch { }
        throw err;
    }
}
