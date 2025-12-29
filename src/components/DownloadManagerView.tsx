import React, { useEffect, useState, useMemo } from 'react';
import { DownloadJob, SongMeta } from '../../shared/songTypes';
import SongList from './SongList';
import { useLibrary } from '../contexts/LibraryContext';

const DownloadManagerView: React.FC = () => {
    const [jobs, setJobs] = useState<DownloadJob[]>([]);
    const { songs } = useLibrary();

    useEffect(() => {
        // Initial load
        window.khelper?.downloads.getAllJobs().then(setJobs);

        // Subscribe
        const unsubscribe = window.khelper?.downloads.subscribeUpdates((updated) => {
            setJobs(updated);
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    const activeJobs = jobs.filter(j => ['queued', 'downloading', 'processing'].includes(j.status));
    const failedJobs = jobs.filter(j => j.status === 'failed');

    // Filter out failed jobs from history for the SongList, keep only completed
    const completedJobs = jobs.filter(j => j.status === 'completed');

    // Map history jobs to SongMeta for SongList
    const historySongs = useMemo(() => {
        return completedJobs.map(job => {
            // Try to find the actual song in the library
            const existingSong = songs.find(s => s.id === job.songId);
            if (existingSong) return existingSong;

            // Fallback (rare for completed jobs unless song deleted)
            return {
                id: job.songId || `job-${job.id}`,
                title: job.title,
                artist: job.artist,
                type: '原曲',
                audio_status: 'original_only',
                lyrics_status: 'none',
                source: { kind: 'youtube', youtubeId: job.youtubeId, originalPath: '' },
                stored_filename: '',
                created_at: job.createdAt,
                last_separation_error: job.error || null,
                _isJob: true,
                _jobStatus: job.status
            } as unknown as SongMeta;
        });
    }, [completedJobs, songs]);

    const handleRetry = async (job: DownloadJob) => {
        if (!window.khelper?.downloads) return;
        try {
            await window.khelper.downloads.queueDownload(
                `https://www.youtube.com/watch?v=${job.youtubeId}`,
                job.quality,
                job.title,
                job.artist,
                job.type,
                job.lyricsText
            );
        } catch (err) {
            console.error('Retry failed', err);
            alert('重試失敗: ' + (err as Error).message);
        }
    };

    const handleDeleteJob = async (id: string) => {
        if (!window.khelper?.downloads) return;
        if (confirm('確定要移除此下載紀錄嗎？')) {
            await window.khelper.downloads.removeJob(id);
        }
    };

    const handleCopyError = (error: string) => {
        navigator.clipboard.writeText(error);
        alert('錯誤訊息已複製');
    };

    const renderProgressBar = (progress: number) => (
        <div style={{ width: '100%', height: '4px', backgroundColor: '#333', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--accent-color)', transition: 'width 0.2s' }} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '32px 32px 0' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 24px' }}>下載管理</h1>

                {/* Active Downloads Section */}
                <section style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        下載中 <span style={{ fontSize: '12px', color: '#888', background: '#222', padding: '2px 8px', borderRadius: '12px' }}>{activeJobs.length}</span>
                    </h2>

                    {activeJobs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                            {activeJobs.map(job => (
                                <div key={job.id} style={{ background: '#1f1f1f', padding: '16px', borderRadius: '8px', border: '1px solid #2f2f2f' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <div style={{ fontWeight: 600, color: '#fff' }}>
                                            {job.title} <span style={{ fontWeight: 'normal', color: '#888' }}>{job.artist ? `- ${job.artist}` : ''}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#aaa' }}>{job.status === 'queued' ? '排隊中...' : `${job.progress.toFixed(1)}%`}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {job.quality === 'best' ? '最佳' : job.quality === 'high' ? '高音質' : '普通'} • YouTube ID: {job.youtubeId}
                                    </div>
                                    {renderProgressBar(job.progress)}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Failed Downloads Section */}
                {failedJobs.length > 0 && (
                    <section style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '18px', color: '#ff6b6b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            下載失敗 <span style={{ fontSize: '12px', color: '#fff', background: '#ff3b3b', padding: '2px 8px', borderRadius: '12px' }}>{failedJobs.length}</span>
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                            {failedJobs.map(job => (
                                <div key={job.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: '16px',
                                    background: '#2a1f1f',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #4a2f2f',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#ffcece' }}>
                                            {job.title} <span style={{ fontWeight: 'normal', color: '#aa8888' }}>{job.artist ? `- ${job.artist}` : ''}</span>
                                        </div>
                                        <div
                                            title={job.error}
                                            style={{
                                                fontSize: '12px',
                                                color: '#ff8888',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '400px',
                                                cursor: 'help'
                                            }}
                                        >
                                            {job.error}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleRetry(job)}
                                            style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            重試
                                        </button>
                                        <button
                                            onClick={() => handleCopyError(job.error || '')}
                                            style={{ background: '#333', border: 'none', color: '#ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            複製錯誤
                                        </button>
                                        <button
                                            onClick={() => handleDeleteJob(job.id)}
                                            style={{ background: '#442222', border: '1px solid #663333', color: '#ff6b6b', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            移除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Completed / History Section - Using SongList */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 32px 32px' }}>
                <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px' }}>已下載</h2>

                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <SongList
                        songs={historySongs}
                        context="library"
                        emptyMessage="尚無下載紀錄"
                        showType={true}
                        showAudioStatus={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default DownloadManagerView;
