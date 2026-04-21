const fs = require('fs');
let b = fs.readFileSync('electron/downloadJobs.ts', 'utf8');

b = b.replace(
  "import { spawn } from 'node:child_process';",
  "import { spawn } from 'node:child_process';\nimport yts from 'yt-search';"
);

const oldSearch = `export async function searchYouTube(query: string): Promise<any[]> {
    await ensureBinaries();
    const ytDlp = getYtDlpPath();
    const bundledBin = getBundledBinDir();
    const ffmpegPath = bundledBin;
    const nodePath = path.join(bundledBin, 'node.exe');

    return new Promise((resolve) => {
        const proc = spawn(ytDlp, [
            '--ffmpeg-location', ffmpegPath,
            '--js-runtimes', \`node:\${nodePath}\`,
            '--dump-json',
            '--no-playlist',
            \`ytsearch10:\${query}\`
        ]);

        let stdout = '';
        proc.stdout.on('data', d => stdout += d.toString());

        proc.on('close', code => {
            try {
                const lines = stdout.trim().split('\\n');
                const results = lines.filter(l => l.trim()).map(l => {
                    const data = JSON.parse(l);
                    return {
                        videoId: data.id,
                        title: data.title,
                        artist: data.uploader || data.channel,
                        duration: data.duration,
                        thumbnailUrl: data.thumbnail
                    };
                });
                resolve(results);
            } catch (e) {
                resolve([]);
            }
        });
    });
}`;

const newSearch = `export async function searchYouTube(query: string): Promise<any[]> {
    try {
        const r = await yts(query);
        const results = r.videos.slice(0, 10).map((v: any) => ({
            videoId: v.videoId,
            title: v.title,
            artist: v.author.name,
            duration: v.seconds,
            thumbnailUrl: v.thumbnail
        }));
        return results;
    } catch (e) {
        console.error("yt-search error:", e);
        return [];
    }
}`;

b = b.replace(oldSearch, newSearch);
// Wait, the carriage returns in oldSearch might not match exactly inside string replacement without normalized spaces. Let's do it using Regex.

b = b.replace(/export async function searchYouTube[\s\S]*?\}\);[\s\n\r]*\}/, newSearch);

fs.writeFileSync('electron/downloadJobs.ts', b);
console.log("Done");
