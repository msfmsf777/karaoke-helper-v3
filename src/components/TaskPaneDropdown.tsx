import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { SeparationJob } from '../jobs/separationJobs';
import { getAllJobs, subscribeJobUpdates } from '../jobs/separationJobs';
import { loadAllSongs, SongMeta } from '../library/songLibrary';
import { DownloadJob } from '../../shared/songTypes';

interface TaskPaneDropdownProps {
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

/* ── Status helpers ─────────────────────────────────────────── */

const sepStatusLabels: Record<SeparationJob['status'], string> = {
  queued: '排程中',
  running: '處理中',
  succeeded: '已完成',
  failed: '失敗',
};

const sepStatusColor = (status: SeparationJob['status']) => {
  switch (status) {
    case 'succeeded': return '#8be28b';
    case 'failed': return '#ff8b8b';
    case 'running': return '#e0a040';
    default: return '#b3b3b3';
  }
};


/* ── Copy-to-clipboard button ──────────────────────────────── */

const CopyErrorButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none',
        border: 'none',
        color: copied ? '#8be28b' : '#aaa',
        cursor: 'pointer',
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '4px',
        transition: 'color 0.2s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {copied ? '已複製 ✓' : '複製錯誤'}
    </button>
  );
};

/* ── Inline error block ─────────────────────────────────────── */

const ErrorBlock: React.FC<{ message: string; defaultExpanded?: boolean }> = ({ message, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ marginTop: '4px' }}>
      <div
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        style={{
          fontSize: '11px',
          color: '#ff8888',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span style={{ fontSize: '9px', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        {expanded ? '隱藏錯誤' : '查看錯誤'}
      </div>
      {expanded && (
        <div style={{
          marginTop: '4px',
          padding: '6px 8px',
          background: 'rgba(255, 80, 80, 0.08)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 80, 80, 0.15)',
          maxHeight: '60px',
          overflowY: 'auto',
          display: 'flex',
          gap: '6px',
          alignItems: 'flex-start',
        }}>
          <div style={{
            flex: 1,
            fontSize: '11px',
            color: '#ff9999',
            fontFamily: 'Consolas, monospace',
            lineHeight: '1.4',
            wordBreak: 'break-all',
            minWidth: 0,
          }}>
            {message}
          </div>
          <CopyErrorButton text={message} />
        </div>
      )}
    </div>
  );
};

/* ── Progress bar ───────────────────────────────────────────── */

const ProgressBar: React.FC<{ value: number; color?: string }> = ({ value, color = 'var(--accent-color)' }) => (
  <div style={{ width: '100%', height: '3px', backgroundColor: '#333', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
    <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', backgroundColor: color, transition: 'width 0.3s ease' }} />
  </div>
);

/* ── Main component ─────────────────────────────────────────── */

const TaskPaneDropdown: React.FC<TaskPaneDropdownProps> = ({ onClose, onNavigate }) => {
  /* Separation jobs state */
  const [sepJobs, setSepJobs] = useState<SeparationJob[]>([]);
  const [songs, setSongs] = useState<Record<string, SongMeta>>({});

  /* Download jobs state */
  const [dlJobs, setDlJobs] = useState<DownloadJob[]>([]);

  const refreshSongs = useCallback(async () => {
    try {
      const list = await loadAllSongs();
      const map = Object.fromEntries(list.map((s) => [s.id, s]));
      setSongs(map);
    } catch (err) {
      console.error('[TaskPane] Failed to refresh songs', err);
    }
  }, []);

  /* Separation subscription */
  useEffect(() => {
    const load = async () => {
      try {
        const list = await getAllJobs();
        setSepJobs(list);
      } catch (err) {
        console.error('[TaskPane] Failed to load separation jobs', err);
      }
    };
    load();
    refreshSongs();

    const unsub = subscribeJobUpdates((next) => {
      setSepJobs(next);
      refreshSongs();
    });
    return () => unsub();
  }, [refreshSongs]);

  /* Download subscription */
  useEffect(() => {
    window.khelper?.downloads.getAllJobs().then(setDlJobs);
    const unsub = window.khelper?.downloads.subscribeUpdates((updated) => {
      setDlJobs(updated);
    });
    return () => { unsub?.(); };
  }, []);

  /* Derived lists */
  const activeDownloads = useMemo(() =>
    dlJobs.filter(j => ['queued', 'downloading', 'processing'].includes(j.status)),
    [dlJobs]
  );
  const failedDownloads = useMemo(() =>
    dlJobs.filter(j => j.status === 'failed'),
    [dlJobs]
  );
  const recentlyCompleted = useMemo(() => {
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    return dlJobs
      .filter(j => j.status === 'completed' && new Date(j.updatedAt).getTime() > thirtyMinAgo)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [dlJobs]);

  const hasDownloadSection = activeDownloads.length > 0 || failedDownloads.length > 0 || recentlyCompleted.length > 0;
  const isEmpty = sepJobs.length === 0 && !hasDownloadSection;

  const getSongName = (songId: string) => {
    const song = songs[songId];
    if (!song) return songId;
    return `${song.title}${song.artist ? ` - ${song.artist}` : ''}`;
  };

  const handleNavToDownloads = () => {
    onNavigate?.('download-manager');
    onClose();
  };

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: '0',
      width: '380px',
      maxHeight: '70vh',
      background: '#1e1e1e',
      border: '1px solid #2d2d2d',
      borderRadius: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 1000,
      animation: 'taskPaneSlideIn 0.15s ease-out',
    }}>
      <style>{`
        @keyframes taskPaneSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .task-pane-scroll::-webkit-scrollbar { width: 5px; }
        .task-pane-scroll::-webkit-scrollbar-track { background: transparent; }
        .task-pane-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .task-pane-scroll::-webkit-scrollbar-thumb:hover { background: #666; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>處理中任務</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >×</button>
      </div>

      {/* Scrollable body */}
      <div className="task-pane-scroll" style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Download Section (hidden when empty) ──────────── */}
        {hasDownloadSection && (
          <div style={{ borderBottom: '1px solid #2a2a2a' }}>
            <div style={{
              padding: '10px 16px 6px',
              fontSize: '12px',
              color: '#aaa',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              下載
              {activeDownloads.length > 0 && (
                <span style={{
                  fontSize: '11px',
                  color: '#888',
                  background: '#282828',
                  padding: '1px 6px',
                  borderRadius: '8px',
                }}>{activeDownloads.length}</span>
              )}
            </div>

            {/* Active downloads */}
            {activeDownloads.map(job => (
              <div key={job.id} style={{ padding: '8px 16px', borderTop: '1px solid #252525' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: '13px',
                    color: '#e6e6e6',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {job.title}{job.artist ? ` - ${job.artist}` : ''}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#aaa',
                    marginLeft: '8px',
                    flexShrink: 0,
                  }}>
                    {job.status === 'queued' ? '排隊中...' : `${job.progress.toFixed(1)}%`}
                  </div>
                </div>
                {job.status !== 'queued' && <ProgressBar value={job.progress} />}
              </div>
            ))}

            {/* Failed downloads */}
            {failedDownloads.map(job => (
              <div key={job.id} style={{ padding: '8px 16px', borderTop: '1px solid #252525' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: '13px',
                    color: '#ffcece',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {job.title}{job.artist ? ` - ${job.artist}` : ''}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#ff8b8b',
                    marginLeft: '8px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff8b8b', display: 'inline-block' }} />
                    失敗
                  </div>
                </div>
                {job.error && <ErrorBlock message={job.error} defaultExpanded={false} />}
              </div>
            ))}

            {/* Recently completed downloads */}
            {recentlyCompleted.map(job => (
              <div key={job.id} style={{ padding: '8px 16px', borderTop: '1px solid #252525' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: '13px',
                    color: '#aaa',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {job.title}{job.artist ? ` - ${job.artist}` : ''}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8be28b',
                    marginLeft: '8px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8be28b', display: 'inline-block' }} />
                    已完成
                  </div>
                </div>
              </div>
            ))}

            {/* Nav to download manager */}
            <div
              onClick={handleNavToDownloads}
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                color: 'var(--accent-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderTop: '1px solid #252525',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>▸</span> 查看所有下載結果
            </div>
          </div>
        )}

        {/* ── Separation Jobs Section ───────────────────────── */}
        {sepJobs.length > 0 && (
          <div>
            <div style={{
              padding: '10px 16px 6px',
              fontSize: '12px',
              color: '#aaa',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              歌曲分離
              <span style={{
                fontSize: '11px',
                color: '#888',
                background: '#282828',
                padding: '1px 6px',
                borderRadius: '8px',
              }}>{sepJobs.length}</span>
            </div>

            {sepJobs.map((job, idx) => (
              <div key={job.id} style={{
                padding: '8px 16px',
                borderTop: '1px solid #252525',
              }}>
                {/* Title + status row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: '13px',
                    color: '#e6e6e6',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {getSongName(job.songId)}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: sepStatusColor(job.status),
                    marginLeft: '8px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: sepStatusColor(job.status),
                      display: 'inline-block',
                    }} />
                    {sepStatusLabels[job.status]}
                  </div>
                </div>

                {/* Quality badge */}
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                  {job.quality === 'high' ? 'HQ' : job.quality === 'fast' ? '快速' : '標準'}
                </div>

                {/* Progress bar for running */}
                {job.status === 'running' && typeof job.progress === 'number' && (
                  <ProgressBar value={job.progress} color="#e0a040" />
                )}

                {/* Error block for failed */}
                {job.status === 'failed' && job.errorMessage && (
                  <ErrorBlock message={job.errorMessage} defaultExpanded={idx === 0} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Global empty state ────────────────────────────── */}
        {isEmpty && (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#666',
            fontSize: '13px',
          }}>
            目前沒有任務
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskPaneDropdown;
