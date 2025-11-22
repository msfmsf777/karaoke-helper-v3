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
    const historyJobs = jobs.filter(j => ['completed', 'failed'].includes(j.status));

    // Map history jobs to SongMeta for SongList
    const historySongs = useMemo(() => {
        return historyJobs.map(job => {
            // Try to find the actual song in the library
            const existingSong = songs.find(s => s.id === job.songId);
            if (existingSong) return existingSong;

            // Fallback for failed jobs or if song not found (deleted?)
            // We construct a fake SongMeta to display in the list
            return {
                id: job.songId || `job-${job.id}`,
                title: job.title,
                artist: job.artist,
                type: '原曲', // Default
                audio_status: 'original_only',
                lyrics_status: 'none',
                source: {
                    kind: 'youtube',
                    youtubeId: job.youtubeId,
                    originalPath: ''
                },
                stored_filename: '',
                created_at: job.createdAt,
                updated_at: job.updatedAt,
                last_separation_error: job.error || null,
                // Add a flag to indicate this is a job entry, not a real song if failed
                _isJob: true,
                _jobStatus: job.status
            } as SongMeta & { _isJob?: boolean; _jobStatus?: string };
        });
    }, [historyJobs, songs]);

    const renderProgressBar = (progress: number) => (
        <div style={{ width: '100%', height: '4px', backgroundColor: '#333', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--accent-color)', transition: 'width 0.2s' }} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '32px 32px 0' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 24px' }}>下載管理</h1>

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
                        renderCustomActions={(song) => {
                            const job = historyJobs.find(j => j.songId === song.id || `job-${j.id}` === song.id);
                            if (job && job.status === 'failed') {
                                return <span style={{ color: '#ff6b6b', fontSize: '12px' }}>失敗: {job.error}</span>;
                            }
                            return null;
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default DownloadManagerView;
