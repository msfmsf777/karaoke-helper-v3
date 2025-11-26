import React, { useEffect, useState } from 'react';
import LyricsOverlay from './LyricsOverlay';
import LyricStylePopup from './LyricStylePopup';
import { SongMeta, EnrichedLyricLine } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';
import audioEngine from '../audio/AudioEngine';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { isJapanese } from '../utils/japaneseDetection';
import ObsLinkIcon from '../assets/icons/obs_link.svg';

interface StreamModeViewProps {
  currentTrack: { id: string; title: string; artist?: string } | null;
  currentTime: number;
  isPlaying: boolean;
  onExit: () => void;
  onOpenOverlayWindow: () => void;
}

const StreamModeView: React.FC<StreamModeViewProps> = ({
  currentTime,
  onExit,
}) => {
  const { queue, currentIndex, playQueueIndex } = useQueue();
  const { getSongById } = useLibrary();
  const { lyricStyles, setLyricStyles, songPreferences, setSongPreference } = useUserData();

  const [lines, setLines] = useState<EditableLyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');
  const [showStylePopup, setShowStylePopup] = useState(false);

  // Japanese Enrichment State
  const [isJp, setIsJp] = useState(false);
  const [enrichedLines, setEnrichedLines] = useState<EnrichedLyricLine[] | null>(null);

  const currentSongId = queue[currentIndex];
  const currentSong = currentSongId ? getSongById(currentSongId) : null;

  // Derive enabled states from preferences or default to false
  const furiganaEnabled = currentSongId ? (songPreferences?.[currentSongId]?.furigana ?? false) : false;
  const romajiEnabled = currentSongId ? (songPreferences?.[currentSongId]?.romaji ?? false) : false;

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
      setIsJp(false);
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
          setIsJp(detectedJp);

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
          setIsJp(false);
          setEnrichedLines(null);
        }

      } catch (err) {
        console.error('[StreamMode] Failed to load lyrics', err);
        if (active) {
          setLines([]);
          setLyricsStatus('none');
          setIsJp(false);
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
    }}>
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

            {queue.length === 0 ? (
              <div style={{ padding: '12px', color: '#444', fontSize: '13px', fontStyle: 'italic' }}>
                播放隊列是空的，請先在歌曲庫中加入歌曲。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {queue.map((songId, index) => {
                  const song = getSongById(songId);
                  const isCurrent = index === currentIndex;

                  if (!song) return null; // Should handle missing songs gracefully

                  return (
                    <div
                      key={`${songId}-${index}`}
                      onClick={() => playQueueIndex(index)}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: isCurrent ? '#1f1f1f' : 'transparent',
                        borderRadius: '8px',
                        borderLeft: isCurrent ? '4px solid var(--accent-color)' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        overflow: 'hidden'
                      }}
                      onMouseOver={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = '#1a1a1a';
                      }}
                      onMouseOut={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        color: isCurrent ? '#fff' : '#ccc',
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        fontSize: '14px',
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={song.title}>
                        {song.title}
                      </div>
                      <div style={{
                        color: '#666',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={song.artist || 'Unknown'}>
                        {song.artist || 'Unknown'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
          {/* Controls Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              gap: '12px',
              zIndex: 20,
            }}
          >
            <button
              onClick={() => {
                const url = 'http://localhost:10001/#/overlay';
                navigator.clipboard.writeText(url);
                alert('已複製 OBS 網址: ' + url);
              }}
              title="複製 OBS 網址"
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              {/* OBS Icon */}
              <img src={ObsLinkIcon} alt="OBS Link" style={{ width: '20px', height: '20px', filter: 'invert(1)' }} />
            </button>
            <button
              onClick={() => setShowStylePopup(!showStylePopup)}
              title="歌詞樣式設定"
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
              }}
            >
              {/* Text Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7V4h16v3" />
                <path d="M9 20h6" />
                <path d="M12 4v16" />
              </svg>
            </button>
            <button
              onClick={onExit}
              title="退出直播模式"
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              {/* Chevron Down Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
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

          {/* Plain Text Tag */}
          {lyricsStatus === 'text_only' && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#aaa',
                fontSize: '12px',
                borderRadius: '4px',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              純文字
            </div>
          )}

          {/* Japanese Enrichment Controls */}
          {isJp && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                display: 'flex',
                gap: '12px',
                zIndex: 20,
              }}
            >
              <button
                onClick={toggleFurigana}
                title="顯示假名 (Furigana)"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: furiganaEnabled ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                あ
              </button>
              <button
                onClick={toggleRomaji}
                title="顯示羅馬音 (Romaji)"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: romajiEnabled ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                }}
              >
                a
              </button>
            </div>
          )}

          <LyricsOverlay
            status={lyricsStatus}
            lines={lines}
            enrichedLines={enrichedLines}
            furiganaEnabled={furiganaEnabled}
            romajiEnabled={romajiEnabled}
            currentTime={currentTime}
            className="stream-lyrics-container"
            onLineClick={(time) => {
              audioEngine.seek(time);
            }}
            styleConfig={lyricStyles}
            onScrollChange={handleScrollChange}
          />

        </div>
      </div>
    </div>
  );
};

export default StreamModeView;
