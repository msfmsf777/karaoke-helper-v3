import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { spawn } from 'node:child_process';
import { getSongsBaseDir } from './songLibrary';
import type { SongMeta, SongType } from '../shared/songTypes';

// --- Types ---

export interface DownloadJob {
    id: string;
    youtubeId: string;
    title: string;
    artist?: string;
    quality: 'best' | 'high' | 'normal';
    type: SongType;
    lyricsText?: string;
    status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    createdAt: string;
    updatedAt: string;
    songId?: string; // ID of the created song in library
}

// --- Constants & Config ---

const YTDLP_FILENAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';


function getBinDir() {
    return path.join(app.getPath('userData'), 'bin');
}

function getYtDlpPath() {
    return path.join(getBinDir(), YTDLP_FILENAME);
}

// --- Binary Management ---

function getBundledBinDir() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'bin');
    }
    return path.join(process.cwd(), 'resources', 'bin');
}

async function ensureBinaries() {
    const binDir = getBinDir();
    await fs.mkdir(binDir, { recursive: true });

    const ytDlpPath = getYtDlpPath();

    try {
        await fs.access(ytDlpPath);
    } catch {
        console.log('[DownloadJobs] yt-dlp not found, downloading...');
        await downloadYtDlp();
    }
}

async function downloadYtDlp() {
    const url = process.platform === 'win32'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    const dest = getYtDlpPath();

    // Using fetch to download
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download yt-dlp: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    await fs.writeFile(dest, Buffer.from(buffer));

    if (process.platform !== 'win32') {
        await fs.chmod(dest, 0o755);
    }
    console.log('[DownloadJobs] yt-dlp downloaded to', dest);
}

// --- Job Management ---

class DownloadJobManager {
    private jobs: DownloadJob[] = [];
    private subscribers = new Set<(jobs: DownloadJob[]) => void>();
    private activeJobId: string | null = null;
    public onLibraryChanged?: () => void;

    constructor() {
        // Check binaries on startup
        ensureBinaries().catch(err => console.error('[DownloadJobs] Failed to ensure binaries on startup:', err));
        this.loadJobs();
    }

    private getJobsFilePath() {
        return path.join(app.getPath('userData'), 'downloadJobs.json');
    }

    private async saveJobs() {
        try {
            await fs.writeFile(this.getJobsFilePath(), JSON.stringify(this.jobs, null, 2));
        } catch (err) {
            console.error('[DownloadJobs] Failed to save jobs', err);
        }
    }

    private async loadJobs() {
        try {
            const data = await fs.readFile(this.getJobsFilePath(), 'utf-8');
            this.jobs = JSON.parse(data);
            // Reset any 'downloading' or 'processing' jobs to 'failed' or 'queued' on startup?
            // For now, let's mark them as failed if they were interrupted.
            let changed = false;
            this.jobs = this.jobs.map(j => {
                if (j.status === 'downloading' || j.status === 'processing') {
                    changed = true;
                    return { ...j, status: 'failed', error: 'Interrupted by app restart' };
                }
                return j;
            });
            if (changed) this.saveJobs();
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                console.error('[DownloadJobs] Failed to load jobs', err);
            }
        } finally {
            // Notify subscribers that initial load is complete
            this.notify();
        }
    }

    private notify() {
        const snapshot = [...this.jobs];
        this.subscribers.forEach(sub => sub(snapshot));
        this.saveJobs();
    }

    subscribe(callback: (jobs: DownloadJob[]) => void) {
        this.subscribers.add(callback);
        callback([...this.jobs]);
        return () => this.subscribers.delete(callback);
    }

    getAll() {
        return [...this.jobs];
    }

    removeJobBySongId(songId: string) {
        const initialLength = this.jobs.length;
        this.jobs = this.jobs.filter(j => j.songId !== songId);
        if (this.jobs.length !== initialLength) {
            this.notify();
        }
    }

    async validateUrl(url: string): Promise<{ videoId: string; title: string; duration?: number } | null> {
        await ensureBinaries();
        const ytDlp = getYtDlpPath();
        const bundledBin = getBundledBinDir();
        const ffmpegPath = bundledBin; // yt-dlp expects directory for --ffmpeg-location
        const nodePath = path.join(bundledBin, 'node.exe');

        return new Promise((resolve) => {
            const proc = spawn(ytDlp, [
                '--ffmpeg-location', ffmpegPath,
                '--js-runtimes', `node:${nodePath}`,
                '--dump-json',
                '--no-playlist',
                url
            ]);

            let stdout = '';
            proc.stdout.on('data', d => stdout += d.toString());

            proc.on('close', code => {
                if (code !== 0) {
                    resolve(null); // Invalid URL or error
                    return;
                }
                try {
                    const data = JSON.parse(stdout);
                    resolve({
                        videoId: data.id,
                        title: data.title,
                        duration: data.duration
                    });
                } catch (e) {
                    resolve(null);
                }
            });
        });
    }

    removeJob(id: string) {
        const initialLength = this.jobs.length;
        this.jobs = this.jobs.filter(j => j.id !== id);
        if (this.jobs.length !== initialLength) {
            this.notify();
        }
    }

    async queueJob(
        url: string,
        quality: 'best' | 'high' | 'normal',
        titleOverride?: string,
        artistOverride?: string,
        type: SongType = '原曲',
        lyricsText?: string
    ) {
        // 1. Validate & Get Metadata
        const meta = await this.validateUrl(url);
        if (!meta) throw new Error('Invalid YouTube URL');

        // 2. Check Duplicates in active jobs
        const existing = this.jobs.find(j => j.youtubeId === meta.videoId);
        if (existing) {
            // Self-healing: If existing job failed, remove it and allow retry
            if (existing.status === 'failed') {
                console.log('[DownloadJobs] Found failed duplicate, removing old job for retry', existing.id);
                this.removeJob(existing.id);
            } else {
                throw new Error('Download already exists for this video');
            }
        }

        // 3. Check library for duplicates
        const { loadAllSongs } = await import('./songLibrary');
        const allSongs = await loadAllSongs();
        const existingSong = allSongs.find(s =>
            s.source.kind === 'youtube' && (s.source as any).youtubeId === meta.videoId
        );

        if (existingSong) {
            throw new Error(`Song already exists in library: "${existingSong.title}"`);
        }

        const job: DownloadJob = {
            id: Date.now().toString(),
            youtubeId: meta.videoId,
            title: titleOverride || meta.title,
            artist: artistOverride,
            quality,
            type,
            lyricsText,
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job;
    }

    private async processQueue() {
        if (this.activeJobId) return;
        const next = this.jobs.find(j => j.status === 'queued');
        if (!next) return;

        this.activeJobId = next.id;
        await this.runJob(next);
        this.activeJobId = null;
        this.processQueue();
    }

    private updateJob(id: string, updates: Partial<DownloadJob>) {
        this.jobs = this.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j);
        this.notify();
    }

    private async runJob(job: DownloadJob) {
        this.updateJob(job.id, { status: 'downloading', progress: 0 });

        try {
            await ensureBinaries();
            const ytDlp = getYtDlpPath();
            const bundledBin = getBundledBinDir();
            const ffmpegPath = bundledBin;
            const nodePath = path.join(bundledBin, 'node.exe');

            // Create song directory
            const songId = Date.now().toString(); // Or use library generator
            const songsDir = getSongsBaseDir();
            const songDir = path.join(songsDir, songId);
            await fs.mkdir(songDir, { recursive: true });

            const outputTemplate = path.join(songDir, 'Original.%(ext)s');

            // Quality mapping for MP3
            // 0 = best (approx 320k), 2 = high (~190-250k), 5 = normal (~128k)
            let audioQuality = '5';
            if (job.quality === 'best') audioQuality = '0';
            if (job.quality === 'high') audioQuality = '2';

            const args = [
                '--ffmpeg-location', ffmpegPath,
                '--js-runtimes', `node:${nodePath}`,
                '-f', 'bestaudio/best', // Download best source
                '-x', // Extract audio
                '--audio-format', 'mp3', // Convert to MP3
                '--audio-quality', audioQuality,
                '-o', outputTemplate,
                '--no-playlist',
                '--newline', // For progress parsing
                `https://www.youtube.com/watch?v=${job.youtubeId}`
            ];

            // Spawn process
            await new Promise<void>((resolve, reject) => {
                const proc = spawn(ytDlp, args);

                proc.stdout.on('data', data => {
                    const line = data.toString();
                    // Parse progress: [download]  23.5% of ...
                    const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
                    if (match) {
                        const percent = parseFloat(match[1]);
                        this.updateJob(job.id, { progress: percent });
                    }
                });

                let errOut = '';
                proc.stderr.on('data', d => errOut += d.toString());

                proc.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`yt-dlp exited with code ${code}: ${errOut}`));
                });
            });

            // Download complete. Now register song in library.
            const finalPath = path.join(songDir, 'Original.mp3');

            // Calculate duration
            let duration: number | undefined;
            try {
                const { parseFile } = await import('music-metadata');
                const metadata = await parseFile(finalPath);
                duration = metadata.format.duration;
            } catch (e) {
                console.warn('Failed to parse duration for downloaded song', e);
            }

            // Create Meta
            const now = new Date().toISOString();

            // Handle Lyrics if provided
            let lyricsRawPath: string | undefined;
            if (job.lyricsText && job.lyricsText.trim().length > 0) {
                const { RAW_LYRICS_FILENAME } = await import('./songLibrary');
                lyricsRawPath = path.join(songDir, RAW_LYRICS_FILENAME);
                // Sanitize line endings
                const content = job.lyricsText.replace(/\r\n/g, '\n');
                await fs.writeFile(lyricsRawPath, content, 'utf-8');
            }

            const meta: SongMeta = {
                id: songId,
                title: job.title,
                artist: job.artist,
                type: job.type || '原曲', // type from job
                audio_status: 'original_only',
                lyrics_status: lyricsRawPath ? 'text_only' : 'none', // Set based on lyrics presence
                lyrics_raw_path: lyricsRawPath,
                lyrics_lrc_path: undefined,
                source: {
                    kind: 'youtube',
                    youtubeId: job.youtubeId,
                    originalPath: finalPath
                },
                stored_filename: 'Original.mp3',
                created_at: now,
                updated_at: now,
                last_separation_error: null,
                duration
            };

            await fs.writeFile(path.join(songDir, 'meta.json'), JSON.stringify(meta, null, 2));

            this.updateJob(job.id, { status: 'completed', progress: 100, songId });

            // Invalidate library cache so the new song is picked up
            const { invalidateCache } = await import('./songLibrary');
            invalidateCache();

            // Notify library change
            this.onLibraryChanged?.();

        } catch (err: any) {
            console.error('Download failed', err);
            this.updateJob(job.id, { status: 'failed', error: err.message });
        }
    }
}

export const downloadManager = new DownloadJobManager();
