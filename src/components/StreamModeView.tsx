import React, { useEffect, useState } from 'react';
import LyricsOverlay from './LyricsOverlay';
import { SongMeta } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';
import audioEngine from '../audio/AudioEngine';

interface StreamModeViewProps {
  currentTrack: { id: string; title: string; artist?: string } | null;
  currentTime: number;
  isPlaying: boolean;
  onExit: () => void;
  onOpenOverlayWindow: () => void;
}

const StreamModeView: React.FC<StreamModeViewProps> = ({
  currentTrack,
  currentTime,
  isPlaying,
  onExit,
  onOpenOverlayWindow,
}) => {
  const [lines, setLines] = useState<EditableLyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');

  useEffect(() => {
    if (!currentTrack) {
      setLines([]);
      setLyricsStatus('none');
      return;
    }

    let active = true;
    const fetchLyrics = async () => {
      try {
        const [synced, raw] = await Promise.all([
          readSyncedLyrics(currentTrack.id),
          readRawLyrics(currentTrack.id),
        ]);

        if (!active) return;

        if (synced?.content) {
          setLines(parseLrc(synced.content));
          setLyricsStatus('synced');
        } else if (raw?.content && raw.content.trim().length > 0) {
          setLines(linesFromRawText(raw.content));
          setLyricsStatus('text_only');
        } else {
          setLines([]);
          setLyricsStatus('none');
        }
      } catch (err) {
        console.error('[StreamMode] Failed to load lyrics', err);
        if (active) {
          setLines([]);
          setLyricsStatus('none');
        }
      }
    };

    fetchLyrics();
    return () => {
      active = false;
    };
  }, [currentTrack]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Header / Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '4px 12px',
              backgroundColor: '#ff0000',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: '0 0 10px rgba(255,0,0,0.5)',
            }}
          >
            LIVE
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>直播模式</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              const url = 'http://localhost:10001/#/overlay';
              navigator.clipboard.writeText(url);
              // Optional: Show a toast or visual feedback
              alert('已複製 OBS 網址: ' + url);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#222',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            複製 OBS 網址
          </button>
          <button
            onClick={onExit}
            style={{
              padding: '8px 16px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            退出直播模式
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '24px', overflow: 'hidden' }}>
        {/* Left: Setlist / Now Playing */}
        <div
          style={{
            width: '300px',
            backgroundColor: '#111',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #222',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Now Playing
            </h3>
            {currentTrack ? (
              <div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', lineHeight: 1.3, marginBottom: '4px' }}>
                  {currentTrack.title}
                </div>
                <div style={{ color: 'var(--accent-color)', fontSize: '16px' }}>
                  {currentTrack.artist || 'Unknown Artist'}
                </div>
              </div>
            ) : (
              <div style={{ color: '#888' }}>尚未播放</div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <h3
              style={{
                color: '#666',
                fontSize: '12px',
                textTransform: 'uppercase',
                marginBottom: '12px',
                borderBottom: '1px solid #333',
                paddingBottom: '8px',
              }}
            >
              Queue / Setlist
            </h3>
            {/* Placeholder for Queue - reusing current track as the "list" for now since we don't have a real queue system yet */}
            {currentTrack && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#1f1f1f',
                  borderRadius: '8px',
                  borderLeft: '4px solid var(--accent-color)',
                  marginBottom: '8px',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{currentTrack.title}</div>
                <div style={{ color: '#888', fontSize: '12px' }}>{currentTrack.artist}</div>
              </div>
            )}
            <div style={{ padding: '12px', color: '#444', fontSize: '13px', fontStyle: 'italic' }}>
              (播放清單功能開發中...)
            </div>
          </div>
        </div>

        {/* Right: Lyrics Overlay */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#111',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid #222',
          }}
        >
          <LyricsOverlay
            status={lyricsStatus}
            lines={lines}
            currentTime={currentTime}
            className="stream-lyrics-container"
            onLineClick={(time) => {
              audioEngine.seek(time);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default StreamModeView;
