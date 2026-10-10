import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import { getPythonPath } from './pythonRuntime';
import crypto from 'node:crypto';
import type { EnrichedLyricLine } from '../shared/songTypes';
import { detectLyricLanguage, type LyricLanguage } from '../shared/lyricsLanguage';

const CACHE_DIR_NAME = 'lyrics_enrichment_cache';

async function getCacheDir(): Promise<string> {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, CACHE_DIR_NAME);
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
}

function hashLyrics(lines: string[]): string {
    const content = lines.join('\n');
    return crypto.createHash('md5').update(content).digest('hex');
}

export async function enrichLyrics(lines: string[], lang?: LyricLanguage): Promise<EnrichedLyricLine[]> {
    if (!lines || lines.length === 0) return [];

    const resolvedLang: LyricLanguage = (lang && lang !== 'none')
        ? lang
        : detectLyricLanguage(lines.join('\n'));

    if (resolvedLang === 'none') {
        return lines.map(text => ({
            original: text,
            romaji: '',
            ruby: [{ surface: text, furigana: null }]
        }));
    }

    const cacheDir = await getCacheDir();
    const hash = hashLyrics(lines);
    const cacheFile = path.join(cacheDir, `${hash}_${resolvedLang}.json`);

    // Check cache
    try {
        const cached = await fs.readFile(cacheFile, 'utf-8');
        console.log('[LyricEnrichment] Cache hit for', hash, resolvedLang);
        return JSON.parse(cached);
    } catch {
        // Fallback for legacy ja cache format
        if (resolvedLang === 'ja') {
            try {
                const legacyCacheFile = path.join(cacheDir, `${hash}.json`);
                const cached = await fs.readFile(legacyCacheFile, 'utf-8');
                console.log('[LyricEnrichment] Legacy cache hit for', hash);
                return JSON.parse(cached);
            } catch {
                // Cache miss, proceed
            }
        }
    }

    console.log(`[LyricEnrichment] Cache miss, running Python analysis for ${resolvedLang}...`);
    const pythonPath = await getPythonPath();

    // Determine script path
    let scriptPath: string;
    if (app.isPackaged) {
        scriptPath = path.join(process.resourcesPath, 'lyrics', 'cjk_enrichment.py');
    } else {
        scriptPath = path.join(process.cwd(), 'resources', 'lyrics', 'cjk_enrichment.py');
    }

    // Prepare input
    const inputData = {
        lang: resolvedLang,
        lines: lines.map(text => ({ text }))
    };
    const inputJson = JSON.stringify(inputData);

    return new Promise((resolve, reject) => {
        const python = spawn(pythonPath, [scriptPath]);

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', async (code) => {
            if (code !== 0) {
                console.error('[LyricEnrichment] Python process failed', stderr);
                reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                return;
            }

            try {
                const result = JSON.parse(stdout);
                if (result.error) {
                    reject(new Error(result.error));
                    return;
                }

                // Save to cache
                await fs.writeFile(cacheFile, JSON.stringify(result), 'utf-8');
                console.log('[LyricEnrichment] Analysis complete and cached');
                resolve(result as EnrichedLyricLine[]);
            } catch (err) {
                console.error('[LyricEnrichment] Failed to parse output', stdout);
                reject(new Error('Failed to parse Python output'));
            }
        });

        python.on('error', (err) => {
            reject(err);
        });

        // Write input to stdin
        python.stdin.write(inputJson);
        python.stdin.end();
    });
}
