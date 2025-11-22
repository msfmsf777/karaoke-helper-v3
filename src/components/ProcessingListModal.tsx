import React, { useEffect, useMemo, useState } from 'react';
import type { SeparationJob } from '../jobs/separationJobs';
import { getAllJobs, subscribeJobUpdates } from '../jobs/separationJobs';
import { loadAllSongs, SongMeta } from '../library/songLibrary';

interface ProcessingListModalProps {
  open: boolean;
  onClose: () => void;
}

const jobStatusLabels: Record<SeparationJob['status'], string> = {
  queued: '排程中',
  running: '處理中',
  succeeded: '已完成',
  failed: '失敗',
};

const statusColor = (status: SeparationJob['status']) => {
  switch (status) {
    case 'succeeded':
      return '#8be28b';
    case 'failed':
      return '#ff8b8b';
    case 'running':
      return '#e0a040';
    default:
      return '#b3b3b3';
  }
};

const formatTime = (value: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ProcessingListModal: React.FC<ProcessingListModalProps> = ({ open, onClose }) => {
  const [jobs, setJobs] = useState<SeparationJob[]>([]);
  const [songs, setSongs] = useState<Record<string, SongMeta>>({});

  const refreshSongs = async () => {
    try {
      const list = await loadAllSongs();
      const map = Object.fromEntries(list.map((s) => [s.id, s]));
      setSongs(map);
    } catch (err) {
      console.error('[Jobs] Failed to refresh songs for processing list', err);
    }
  };

  const refreshJobs = async () => {
    try {
      const list = await getAllJobs();
      setJobs(list);
    } catch (err) {
      console.error('[Jobs] Failed to load jobs', err);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshJobs();
    refreshSongs();
    const unsubscribe = subscribeJobUpdates((next) => {
      setJobs(next);
      refreshSongs();
    });
    return () => unsubscribe();
  }, [open]);

  const rows = useMemo(() => jobs, [jobs]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '760px',
          maxHeight: '80vh',
          background: '#1c1c1c',
          border: '1px solid #2d2d2d',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 18px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>處理中任務</h2>
            <div style={{ color: '#b3b3b3', fontSize: '13px' }}>
              顯示歌曲分離的排程、進度與結果。
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              background: '#2e2e2e',
              color: '#fff',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            關閉
          </button>
        </div>

        <div
          style={{
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#181818',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr 0.8fr 1.3fr 1.3fr',
              padding: '12px 16px',
              borderBottom: '1px solid #252525',
              color: '#b3b3b3',
              fontSize: '13px',
            }}
          >
            <div>歌曲名稱</div>
            <div>狀態</div>
            <div>品質</div>
            <div>建立時間</div>
            <div>更新時間</div>
          </div>

          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: '16px', color: '#b3b3b3' }}>目前沒有任務。</div>
            ) : (
              rows.map((job) => {
                const song = songs[job.songId];
                const name = song ? `${song.title}${song.artist ? ` - ${song.artist}` : ''}` : job.songId;
                return (
                  <div
                    key={job.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3fr 1fr 0.8fr 1.3fr 1.3fr',
                      padding: '10px 16px',
                      borderBottom: '1px solid #252525',
                      color: '#e6e6e6',
                      alignItems: 'center',
                    }}
                  >
                    <div>{name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: statusColor(job.status) }} title={job.errorMessage || undefined}>
                        {jobStatusLabels[job.status]}
                        {job.status === 'running' && <span style={{ marginLeft: 6 }}>⏳</span>}
                        {job.status === 'failed' && job.errorMessage && (
                          <span style={{ marginLeft: 6, color: '#ffb3b3', fontSize: '12px' }}>查看錯誤</span>
                        )}
                      </div>
                      {job.status === 'running' && typeof job.progress === 'number' && (
                        <div style={{ width: '100%', height: '4px', backgroundColor: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${job.progress}%`,
                              height: '100%',
                              backgroundColor: '#e0a040',
                              transition: 'width 0.2s ease'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>
                      {job.quality === 'high' ? 'HQ' : job.quality === 'fast' ? '快速' : '標準'}
                    </div>
                    <div style={{ color: '#b3b3b3', fontSize: '13px' }}>{formatTime(job.createdAt)}</div>
                    <div style={{ color: '#b3b3b3', fontSize: '13px' }}>{formatTime(job.updatedAt)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingListModal;
