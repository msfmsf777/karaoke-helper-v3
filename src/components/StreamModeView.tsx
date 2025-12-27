
import React, { useEffect, useState } from 'react';
import LyricsOverlay from './LyricsOverlay';
import StreamSetlist from './StreamSetlist';
import LyricStylePopup from './LyricStylePopup';
import { SongMeta, EnrichedLyricLine } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { isJapanese } from '../utils/japaneseDetection';
import WindowControls from './WindowControls';
import StreamControlDropdown from './StreamControlDropdown';
import audioEngine from '../audio/AudioEngine';

interface StreamModeViewProps {
  currentTime: number;
}

const StreamModeView: React.FC<StreamModeViewProps> = ({
  currentTime,
}) => {
  const { currentSongId, resetStream } = useQueue();
  const { getSongById } = useLibrary();
  const { lyricStyles, setLyricStyles, songPreferences, setSongPreference } = useUserData();

  const [lines, setLines] = useState<EditableLyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');
  const [showStylePopup, setShowStylePopup] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Japanese Enrichment State

  const [enrichedLines, setEnrichedLines] = useState<EnrichedLyricLine[] | null>(null);

  const currentSong = currentSongId ? getSongById(currentSongId) : null;

  // Derive enabled states from preferences or default to false
  const furiganaEnabled = currentSongId ? (songPreferences?.[currentSongId]?.furigana ?? false) : false;
  const romajiEnabled = currentSongId ? (songPreferences?.[currentSongId]?.romaji ?? false) : false;

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const toggleFurigana = () => {
    if (currentSongId) {
      setSongPreference(currentSongId, { furigana: !furiganaEnabled });
    }
  };

  const toggleRomaji = () => {
    if (currentSongId) {
      setSongPreference(currentSongId, { romaji: !romajiEnabled });
    }
  };

  // Sync preferences to Overlay
  useEffect(() => {
    if (window.api) {
      window.api.sendOverlayPreferenceUpdate({
        furiganaEnabled,
        romajiEnabled
      });
    }
  }, [furiganaEnabled, romajiEnabled]);

  // Scroll Sync (Text Only)
  const lastScrollTime = React.useRef(0);
  const handleScrollChange = (scrollTop: number) => {
    const now = Date.now();
    if (now - lastScrollTime.current > 50) { // Throttle to ~20fps
      if (window.api) {
        window.api.sendOverlayScrollUpdate(scrollTop);
      }
      lastScrollTime.current = now;
    }
  };

  useEffect(() => {
    if (!currentSongId) {
      setLines([]);
      setLyricsStatus('none');

      setEnrichedLines(null);
      return;
    }

    let active = true;
    const fetchLyrics = async () => {
      try {
        const [synced, raw] = await Promise.all([
          readSyncedLyrics(currentSongId),
          readRawLyrics(currentSongId),
        ]);

        if (!active) return;

        let parsedLines: EditableLyricLine[] = [];
        let status: SongMeta['lyrics_status'] = 'none';
        let rawText = '';

        if (synced?.content) {
          parsedLines = parseLrc(synced.content);
          status = 'synced';
          rawText = parsedLines.map(l => l.text).join('\n');
        } else if (raw?.content && raw.content.trim().length > 0) {
          parsedLines = linesFromRawText(raw.content);
          status = 'text_only';
          rawText = raw.content;
        }

        setLines(parsedLines);
        setLyricsStatus(status);

        if (status !== 'none') {
          const detectedJp = isJapanese(rawText);


          if (detectedJp && window.khelper?.lyrics?.enrichLyrics) {
            window.khelper.lyrics.enrichLyrics(parsedLines.map(l => l.text))
              .then(enriched => {
                if (active) setEnrichedLines(enriched);
              })
              .catch(e => console.error('[StreamMode] Enrichment failed', e));
          } else {
            setEnrichedLines(null);
          }
        } else {

          setEnrichedLines(null);
        }

      } catch (err) {
        console.error('[StreamMode] Failed to load lyrics', err);
        if (active) {
          setLines([]);
          setLyricsStatus('none');

          setEnrichedLines(null);
        }
      }
    };

    fetchLyrics();
    return () => {
      active = false;
    };
  }, [currentSongId]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#000',
      padding: '24px',
      position: 'relative',
      boxSizing: 'border-box',
      // @ts-ignore
      WebkitAppRegion: 'drag',
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(20, 20, 20, 0.9)',
          border: '1px solid var(--accent-color, #00e5ff)',
          color: '#fff',
          padding: '8px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }}>
          <style>{`
            @keyframes toastSlideDown {
              from { opacity: 0; transform: translate(-50%, -20px); }
              to { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00e5ff)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Window Controls (Fade in on hover) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: '8px',
          zIndex: 100,
          opacity: 0,
          transition: 'opacity 0.2s',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
      >
        <WindowControls iconColor="#fff" hoverColor="#fff" variant="stream" />
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
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Now Playing</span>
              <button
                onClick={() => {
                  if (confirmReset) {
                    resetStream();
                    setConfirmReset(false);
                  } else {
                    setConfirmReset(true);
                    setTimeout(() => setConfirmReset(false), 3000);
                  }
                }}
                title={confirmReset ? "再次點擊確認重置" : "重置播放進度"}
                style={{
                  background: confirmReset ? '#ff4444' : 'transparent',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: confirmReset ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px 6px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {confirmReset ? '確認重置?' : '重置'}
              </button>
            </h3>
            {currentSong ? (
              <div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', lineHeight: 1.3, marginBottom: '4px' }}>
                  {currentSong.title}
                </div>
                <div style={{ color: 'var(--accent-color)', fontSize: '16px' }}>
                  {currentSong.artist || 'Unknown Artist'}
                </div>
              </div>
            ) : (
              <div style={{ color: '#888' }}>尚未播放</div>
            )}
          </div>

          {/* New Stream Setlist Component */}
          <StreamSetlist />
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
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
        >
          {/* Controls Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              gap: '12px',
              zIndex: 20,
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
          >
            {/* New Dropdown */}
            <StreamControlDropdown onCopy={() => showToast('已複製')} />

            <button
              onClick={() => setShowStylePopup(!showStylePopup)}
              title="歌詞樣式設定"
              className="stream-control-btn"
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: showStylePopup ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!showStylePopup) e.currentTarget.style.backgroundColor = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                if (!showStylePopup) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)';
              }}
            >
              {/* Text Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7V4h16v3" />
                <path d="M9 20h6" />
                <path d="M12 4v16" />
              </svg>
            </button>
          </div>

          {showStylePopup && (
            <LyricStylePopup
              styles={lyricStyles}
              onChange={setLyricStyles}
              onClose={() => setShowStylePopup(false)}
            />
          )}

          {/* No Lyrics Placeholder */}
          {lyricsStatus === 'none' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#444',
                fontSize: '14px',
              }}
            >
              無歌詞
            </div>
          )}

          {/* Actual Lyrics Component */}
          {lyricsStatus !== 'none' && (
            <LyricsOverlay
              status={lyricsStatus}
              lines={lines}
              enrichedLines={enrichedLines}
              currentTime={currentTime}
              styleConfig={lyricStyles}
              furiganaEnabled={furiganaEnabled}
              romajiEnabled={romajiEnabled}
              onToggleFurigana={toggleFurigana}
              onToggleRomaji={toggleRomaji}
              onScrollChange={handleScrollChange}
              showControls={true}
              onLineClick={(time) => audioEngine.seek(time)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamModeView;
