import React, { useMemo } from 'react';
import { SongMeta } from '../library/songLibrary';
import { useLibrary } from '../contexts/LibraryContext';
import SongList from './SongList';
import SkeletonSongList from './skeletons/SkeletonSongList';
import LibraryIcon from '../assets/icons/library.svg';

interface LibraryViewProps {
  onOpenLyrics?: (song: SongMeta) => void;
  onOpenAddSong?: () => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ onOpenLyrics, onOpenAddSong }) => {
  const { songs, loading } = useLibrary();

  const currentSongs = useMemo(() => songs, [songs]);

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={LibraryIcon} alt="" style={pageTitleIconStyle} />
            歌曲庫
          </h1>
          <div style={{ fontSize: '14px', color: '#888' }}>
            所有已加入的歌曲會顯示在這裡，可直接篩選、排序並播放。
          </div>
        </div>
        <button
          onClick={onOpenAddSong}
          style={{
            padding: '6px 16px',
            backgroundColor: 'var(--accent-color)',
            color: '#000',
            border: 'none',
            borderRadius: '999px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
          }}
        >
          ＋ 新增歌曲
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '0' }}>
            <SkeletonSongList count={12} />
          </div>
        ) : (
          <SongList
            songs={currentSongs}
            context="library"
            listKey="library"
            onEditLyrics={onOpenLyrics}
            emptyMessage="尚未有歌曲，點右上角「＋ 新增歌曲」開始建立你的歌單。"
          />
        )}
      </div>
    </div>
  );
};

const pageTitleIconStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  filter: 'brightness(0) invert(1)',
  opacity: 0.9,
  flexShrink: 0,
};

export default LibraryView;
