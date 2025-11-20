import React from 'react';

const LyricEditorView: React.FC = () => {
  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>歌詞編輯</h1>

      <div
        style={{
          flex: 1,
          backgroundColor: '#181818',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #282828',
          color: '#555',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>尚未開放，敬請期待</div>
          <div style={{ fontSize: '14px' }}>後續階段將支援逐字對齊、時間軸與字幕覆蓋。</div>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
        <button
          style={{
            padding: '12px 24px',
            backgroundColor: '#282828',
            color: '#fff',
            border: 'none',
            borderRadius: '32px',
            fontWeight: 'bold',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          載入歌詞檔
        </button>
        <button
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--accent-color)',
            color: '#000',
            border: 'none',
            borderRadius: '32px',
            fontWeight: 'bold',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          開始編輯
        </button>
      </div>
    </div>
  );
};

export default LyricEditorView;
