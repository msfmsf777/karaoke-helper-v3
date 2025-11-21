import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface QueueData {
    songIds: string[];
    currentIndex: number;
}

const QUEUE_FILE = 'playback_queue.json';

function getQueueFilePath(): string {
    return path.join(app.getPath('userData'), QUEUE_FILE);
}

export async function saveQueue(data: QueueData): Promise<void> {
    try {
        const filePath = getQueueFilePath();
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log('[Queue] Saved queue to', filePath);
    } catch (err) {
        console.error('[Queue] Failed to save queue', err);
    }
}

export async function loadQueue(): Promise<QueueData | null> {
    try {
        const filePath = getQueueFilePath();
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as QueueData;
        console.log('[Queue] Loaded queue from', filePath);
        return data;
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            console.error('[Queue] Failed to load queue', err);
        }
        return null;
    }
}
