import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import {
  createDefaultLyricsConfig,
  createDefaultSetlistConfig,
  createLyricsDesign,
  createSetlistDesign,
  DEFAULT_OVERLAY_FONT,
  findLyricsOverlayDesign,
  findSetlistOverlayDesign,
  getSetlistPresetLabel,
  getSetlistTemplatePreset,
  LyricsOverlayDesign,
  mergeOverlayTemplatesConfig,
  OverlayKind,
  OverlayTemplatesConfig,
  SETLIST_TEMPLATE_PRESETS,
  SETLIST_TEMPLATE_LABELS,
  SetlistOverlayDesign,
  SetlistTemplateId,
} from '../../shared/overlayTemplates';
import {
  getSampleLyrics,
  OverlaySetlistState,
  SAMPLE_SETLIST_STATE,
  TemplatedLyricsOverlay,
  TemplatedSetlistOverlay,
} from './overlayTemplates/OverlayTemplateRenderers';
import { localPathToFileUrl } from '../utils/localFileUrl';
import PrevIcon from '../assets/icons/prev.svg';
import NextIcon from '../assets/icons/next.svg';
import ReplayIcon from '../assets/icons/replay.svg';

const CONTROL_BG = '#2a2a2a';
const PANEL_BG = '#252525';
const BORDER = '1px solid #3a3a3a';

interface OverlayTemplateSettingsSectionProps {
  onOpenEditor: (kind: OverlayKind, designId?: string) => void;
}

const OverlayTemplateSettingsSection: React.FC<OverlayTemplateSettingsSectionProps> = ({ onOpenEditor }) => {
  const { overlayTemplates, setOverlayTemplates } = useUserData();
  const [copied, setCopied] = useState<string | null>(null);

  const updateConfig = (config: OverlayTemplatesConfig) => {
    setOverlayTemplates(mergeOverlayTemplatesConfig(config));
  };

  const copyLink = async (kind: OverlayKind, designId: string) => {
    const label = kind === 'lyrics' ? '歌詞' : '歌單';
    await navigator.clipboard.writeText(`http://localhost:10001/obs/${kind}?design=${encodeURIComponent(designId)}`);
    setCopied(`已複製${label} OBS 連結`);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const addLyricsDesign = () => {
    const id = `lyrics-${Date.now().toString(36)}`;
    const base = findLyricsOverlayDesign(overlayTemplates, overlayTemplates.activeLyricsDesignId);
    updateConfig({
      ...overlayTemplates,
      activeLyricsDesignId: id,
      lyricsDesigns: [...overlayTemplates.lyricsDesigns, createLyricsDesign(id, '新歌詞設計', base)],
    });
    onOpenEditor('lyrics', id);
  };

  const addSetlistDesign = () => {
    const id = `setlist-${Date.now().toString(36)}`;
    const base = findSetlistOverlayDesign(overlayTemplates, overlayTemplates.activeSetlistDesignId);
    updateConfig({
      ...overlayTemplates,
      activeSetlistDesignId: id,
      setlistDesigns: [...overlayTemplates.setlistDesigns, createSetlistDesign(id, '新歌單設計', base)],
    });
    onOpenEditor('setlist', id);
  };

  const duplicateLyricsDesign = (designId: string) => {
    const source = findLyricsOverlayDesign(overlayTemplates, designId);
    const id = `lyrics-${Date.now().toString(36)}`;
    updateConfig({
      ...overlayTemplates,
      activeLyricsDesignId: id,
      lyricsDesigns: [...overlayTemplates.lyricsDesigns, createLyricsDesign(id, `${source.name} 複本`, source)],
    });
    onOpenEditor('lyrics', id);
  };

  const duplicateSetlistDesign = (designId: string) => {
    const source = findSetlistOverlayDesign(overlayTemplates, designId);
    const id = `setlist-${Date.now().toString(36)}`;
    updateConfig({
      ...overlayTemplates,
      activeSetlistDesignId: id,
      setlistDesigns: [...overlayTemplates.setlistDesigns, createSetlistDesign(id, `${source.name} 複本`, source)],
    });
    onOpenEditor('setlist', id);
  };

  const deleteLyricsDesign = (designId: string) => {
    if (overlayTemplates.lyricsDesigns.length <= 1 || designId === 'default') return;
    const design = findLyricsOverlayDesign(overlayTemplates, designId);
    if (!window.confirm(`刪除「${design.name}」？已加入 OBS 的舊連結會回到預設歌詞設計。`)) return;
    const lyricsDesigns = overlayTemplates.lyricsDesigns.filter(candidate => candidate.id !== designId);
    updateConfig({
      ...overlayTemplates,
      activeLyricsDesignId: lyricsDesigns.some(candidate => candidate.id === overlayTemplates.activeLyricsDesignId)
        ? overlayTemplates.activeLyricsDesignId
        : lyricsDesigns[0]?.id ?? 'default',
      lyricsDesigns,
    });
  };

  const deleteSetlistDesign = (designId: string) => {
    if (overlayTemplates.setlistDesigns.length <= 1 || designId === 'default') return;
    const design = findSetlistOverlayDesign(overlayTemplates, designId);
    if (!window.confirm(`刪除「${design.name}」？已加入 OBS 的舊連結會回到預設歌單設計。`)) return;
    const setlistDesigns = overlayTemplates.setlistDesigns.filter(candidate => candidate.id !== designId);
    updateConfig({
      ...overlayTemplates,
      activeSetlistDesignId: setlistDesigns.some(candidate => candidate.id === overlayTemplates.activeSetlistDesignId)
        ? overlayTemplates.activeSetlistDesignId
        : setlistDesigns[0]?.id ?? 'default',
      setlistDesigns,
    });
  };

  return (
    <section id="overlay-template-settings-section" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
      <SectionTitle title="直播覆蓋模板" />
      <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px 16px' }}>
        管理 OBS Browser Source 專用的歌詞與歌單外觀。歌詞設計與歌單設計彼此獨立，修改後不會影響 App 內直播畫面。
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <OverviewGroup
          title="歌詞覆蓋設計"
          description="控制 OBS 歌詞來源的字體、行數、顏色、動畫與注音 / 羅馬字顯示。"
          designs={overlayTemplates.lyricsDesigns}
          onAdd={addLyricsDesign}
          onEdit={(id) => onOpenEditor('lyrics', id)}
          onDuplicate={duplicateLyricsDesign}
          onCopy={(id) => copyLink('lyrics', id)}
          onDelete={deleteLyricsDesign}
          canDelete={(id) => overlayTemplates.lyricsDesigns.length > 1 && id !== 'default'}
          summary={(design) => {
            const lyricsDesign = design as LyricsOverlayDesign;
            return lyricsDesign.config.lineMode === 'fill' ? '填滿高度' : `顯示 ${lyricsDesign.config.lineCount} 行`;
          }}
        />

        <OverviewGroup
          title="歌單覆蓋設計"
          description="控制 OBS 歌單來源的目前歌曲、待播、已唱、縮圖、外框與清單滾動方式。"
          designs={overlayTemplates.setlistDesigns}
          onAdd={addSetlistDesign}
          onEdit={(id) => onOpenEditor('setlist', id)}
          onDuplicate={duplicateSetlistDesign}
          onCopy={(id) => copyLink('setlist', id)}
          onDelete={deleteSetlistDesign}
          canDelete={(id) => overlayTemplates.setlistDesigns.length > 1 && id !== 'default'}
          summary={(design) => {
            const config = (design as SetlistOverlayDesign).config;
            return `${SETLIST_TEMPLATE_LABELS[config.templateId]} · ${getSetlistPresetLabel(config.templateId, config.presetId)}`;
          }}
        />
      </div>

      {copied && <div style={{ color: 'var(--accent-color)', fontSize: 12, marginTop: 12 }}>{copied}</div>}
    </section>
  );
};

type OverviewDesign = LyricsOverlayDesign | SetlistOverlayDesign;

const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;

const OverviewGroup: React.FC<{
  title: string;
  description: string;
  designs: OverviewDesign[];
  summary: (design: any) => string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: (id: string) => boolean;
}> = ({ title, description, designs, summary, onAdd, onEdit, onDuplicate, onCopy, onDelete, canDelete }) => (
  <div style={{ background: CONTROL_BG, border: BORDER, borderRadius: 12, padding: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
      <div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>{title}</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{description}</div>
      </div>
      <SmallButton onClick={onAdd} primary>新增</SmallButton>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {designs.map(design => (
        <div
          key={design.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 14,
            alignItems: 'center',
            padding: 12,
            borderRadius: 10,
            border: BORDER,
            background: '#222',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {design.name}
              </div>
            </div>
            <div style={{ color: '#aaa', fontSize: 12, marginTop: 7, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{summary(design)}</span>
              <span>ID：{design.id}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <SmallButton onClick={() => onEdit(design.id)}>編輯</SmallButton>
            <SmallButton onClick={() => onDuplicate(design.id)}>複製</SmallButton>
            <SmallButton onClick={() => onCopy(design.id)}>複製 OBS 連結</SmallButton>
            <SmallButton onClick={() => onDelete(design.id)} disabled={!canDelete(design.id)} danger>刪除</SmallButton>
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface OverlayTemplateEditorProps {
  initialKind: OverlayKind;
  initialDesignId?: string;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const OverlayTemplateEditor: React.FC<OverlayTemplateEditorProps> = ({ initialKind, initialDesignId, onClose, onDirtyChange }) => {
  const { overlayTemplates, setOverlayTemplates } = useUserData();
  const { queue, currentIndex, isStreamWaiting, playbackMode } = useQueue();
  const { getSongById } = useLibrary();
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const designMenuRef = useRef<HTMLDivElement | null>(null);
  const [editorViewport, setEditorViewport] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<OverlayTemplatesConfig>(() => mergeOverlayTemplatesConfig(overlayTemplates));
  const [kind] = useState<OverlayKind>(initialKind);
  const [selectedDesignId, setSelectedDesignId] = useState(
    initialDesignId ?? (initialKind === 'lyrics' ? overlayTemplates.activeLyricsDesignId : overlayTemplates.activeSetlistDesignId)
  );
  const [setlistPreviewDataMode, setSetlistPreviewDataMode] = useState<'sample' | 'current'>('sample');
  const [lyricsPreviewTime, setLyricsPreviewTime] = useState(0);
  const [lyricsPreviewPlaying, setLyricsPreviewPlaying] = useState(false);
  const [setlistPreviewMode, setSetlistPreviewMode] = useState<'normal' | 'stream'>('stream');
  const [setlistPreviewIndex, setSetlistPreviewIndex] = useState(0);
  const [setlistPreviewWaiting, setSetlistPreviewWaiting] = useState(true);
  const [designMenuOpen, setDesignMenuOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [fonts, setFonts] = useState<string[]>([
    DEFAULT_OVERLAY_FONT,
    '"Microsoft JhengHei", sans-serif',
    '"Noto Sans TC", sans-serif',
    '"Segoe UI", sans-serif',
    '"Arial", sans-serif',
  ]);

  const selectedLyricsDesign = findLyricsOverlayDesign(draft, selectedDesignId);
  const selectedSetlistDesign = findSetlistOverlayDesign(draft, selectedDesignId);
  const selectedDesign = kind === 'lyrics' ? selectedLyricsDesign : selectedSetlistDesign;
  const designs = kind === 'lyrics' ? draft.lyricsDesigns : draft.setlistDesigns;
  const isDirty = JSON.stringify(overlayTemplates) !== JSON.stringify(draft);
  const sampleLyrics = useMemo(() => getSampleLyrics(), []);
  const lyricsPreview = sampleLyrics;
  const lyricsDuration = Math.max(1, ...lyricsPreview.lines.map(line => Number(line.timeSeconds ?? 0))) + 1.2;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const queryLocalFonts = (window as any).queryLocalFonts;
        if (typeof queryLocalFonts !== 'function') return;
        const localFonts = await queryLocalFonts();
        const names = Array.from(new Set(
          localFonts
            .map((font: { family?: string }) => font.family)
            .filter(Boolean)
            .map((name: string) => `"${name}", sans-serif`)
        )) as string[];
        if (names.length) {
          setFonts(prev => Array.from(new Set([...prev, ...names])).slice(0, 80));
        }
      } catch {
        // Optional Chromium API; safe font presets remain available.
      }
    };
    loadFonts();
  }, []);

  useEffect(() => {
    if (kind !== 'lyrics' || !lyricsPreviewPlaying) return;
    const id = window.setInterval(() => {
      setLyricsPreviewTime(prev => {
        const next = prev + 0.25;
        return next > lyricsDuration ? 0 : next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [kind, lyricsPreviewPlaying, lyricsDuration]);

  const currentSetlistState = useMemo<OverlaySetlistState>(() => {
    const songs = Object.fromEntries(queue.map(id => {
      const song = getSongById(id);
      if (!song) return [id, { id, title: 'Unknown', artist: '' }];
      return [id, {
        id,
        title: song.title,
        artist: song.artist,
        type: song.type,
        source: song.source.kind,
        duration: song.duration,
        thumbnailUrl: localPathToFileUrl(song.thumbnail_path) || song.thumbnailUrl,
      }];
    }));

    return {
      queue: queue.length ? queue : SAMPLE_SETLIST_STATE.queue,
      currentIndex: queue.length ? currentIndex : SAMPLE_SETLIST_STATE.currentIndex,
      isStreamWaiting: queue.length ? isStreamWaiting : SAMPLE_SETLIST_STATE.isStreamWaiting,
      playbackMode: queue.length ? playbackMode : SAMPLE_SETLIST_STATE.playbackMode,
      songs: queue.length ? songs : SAMPLE_SETLIST_STATE.songs,
    };
  }, [queue, currentIndex, isStreamWaiting, playbackMode, getSongById]);

  const sampleSetlistState = useMemo<OverlaySetlistState>(() => ({
    ...SAMPLE_SETLIST_STATE,
    currentIndex: Math.max(0, Math.min(
      setlistPreviewMode === 'stream' ? SAMPLE_SETLIST_STATE.queue.length : SAMPLE_SETLIST_STATE.queue.length - 1,
      setlistPreviewIndex
    )),
    playbackMode: setlistPreviewMode === 'stream' ? 'stream' : 'normal',
    isStreamWaiting: setlistPreviewMode === 'stream' && setlistPreviewWaiting,
  }), [setlistPreviewIndex, setlistPreviewMode, setlistPreviewWaiting]);

  const previewSetlistState = setlistPreviewDataMode === 'current' ? currentSetlistState : sampleSetlistState;
  const compactEditor = editorViewport.width > 0 && editorViewport.width < 1120;
  const tightEditor = editorViewport.width > 0 && editorViewport.width < 920;
  const editorGap = tightEditor ? 10 : compactEditor ? 12 : 16;
  const editorPanelPadding = tightEditor ? 10 : compactEditor ? 12 : 14;
  const editorGridColumns = tightEditor
    ? 'minmax(0, 1fr) minmax(250px, 260px)'
    : compactEditor
      ? 'minmax(0, 1fr) minmax(270px, 285px)'
      : 'minmax(0, 1fr) minmax(300px, 320px)';

  useEffect(() => {
    const element = editorViewportRef.current;
    if (!element) return;

    const updateSize = () => setEditorViewport({
      width: element.clientWidth,
      height: element.clientHeight,
    });
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!designMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const menu = designMenuRef.current;
      if (menu && !menu.contains(event.target as Node)) {
        setDesignMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [designMenuOpen]);

  const updateLyricsDesign = (recipe: (design: LyricsOverlayDesign) => LyricsOverlayDesign) => {
    setDraft(prev => ({
      ...prev,
      lyricsDesigns: prev.lyricsDesigns.map(design => design.id === selectedLyricsDesign.id ? recipe(design) : design),
    }));
  };

  const updateSetlistDesign = (recipe: (design: SetlistOverlayDesign) => SetlistOverlayDesign) => {
    setDraft(prev => ({
      ...prev,
      setlistDesigns: prev.setlistDesigns.map(design => design.id === selectedSetlistDesign.id ? recipe(design) : design),
    }));
  };

  const updateName = (name: string) => {
    if (kind === 'lyrics') updateLyricsDesign(design => ({ ...design, name }));
    else updateSetlistDesign(design => ({ ...design, name }));
  };

  const addDesign = () => {
    const id = `${kind}-${Date.now().toString(36)}`;
    if (kind === 'lyrics') {
      setDraft(prev => ({
        ...prev,
        activeLyricsDesignId: id,
        lyricsDesigns: [...prev.lyricsDesigns, createLyricsDesign(id, '新歌詞設計', selectedLyricsDesign)],
      }));
    } else {
      setDraft(prev => ({
        ...prev,
        activeSetlistDesignId: id,
        setlistDesigns: [...prev.setlistDesigns, createSetlistDesign(id, '新歌單設計', selectedSetlistDesign)],
      }));
    }
    setSelectedDesignId(id);
  };

  const duplicateDesign = () => {
    const id = `${kind}-${Date.now().toString(36)}`;
    if (kind === 'lyrics') {
      setDraft(prev => ({
        ...prev,
        activeLyricsDesignId: id,
        lyricsDesigns: [...prev.lyricsDesigns, createLyricsDesign(id, `${selectedLyricsDesign.name} 複本`, selectedLyricsDesign)],
      }));
    } else {
      setDraft(prev => ({
        ...prev,
        activeSetlistDesignId: id,
        setlistDesigns: [...prev.setlistDesigns, createSetlistDesign(id, `${selectedSetlistDesign.name} 複本`, selectedSetlistDesign)],
      }));
    }
    setSelectedDesignId(id);
  };

  const deleteDesign = () => {
    if (designs.length <= 1 || selectedDesign.id === 'default') return;
    if (!window.confirm(`刪除「${selectedDesign.name}」？已加入 OBS 的舊連結會回到預設設計。`)) return;
    if (kind === 'lyrics') {
      const nextDesigns = draft.lyricsDesigns.filter(design => design.id !== selectedDesign.id);
      const nextActive = nextDesigns[0]?.id ?? 'default';
      setDraft(prev => ({ ...prev, lyricsDesigns: nextDesigns, activeLyricsDesignId: nextActive }));
      setSelectedDesignId(nextActive);
    } else {
      const nextDesigns = draft.setlistDesigns.filter(design => design.id !== selectedDesign.id);
      const nextActive = nextDesigns[0]?.id ?? 'default';
      setDraft(prev => ({ ...prev, setlistDesigns: nextDesigns, activeSetlistDesignId: nextActive }));
      setSelectedDesignId(nextActive);
    }
  };

  const selectDesignFromMenu = (designId: string) => {
    setSelectedDesignId(designId);
    setDesignMenuOpen(false);
  };

  const addDesignFromMenu = () => {
    addDesign();
    setDesignMenuOpen(false);
  };

  const duplicateDesignFromMenu = () => {
    duplicateDesign();
    setDesignMenuOpen(false);
  };

  const deleteDesignFromMenu = () => {
    deleteDesign();
    setDesignMenuOpen(false);
  };

  const saveDraft = () => {
    const withActive = kind === 'lyrics'
      ? { ...draft, activeLyricsDesignId: selectedLyricsDesign.id }
      : { ...draft, activeSetlistDesignId: selectedSetlistDesign.id };
    const merged = mergeOverlayTemplatesConfig(withActive);
    setOverlayTemplates(merged);
    setDraft(merged);
    setCopied('已儲存並更新 OBS');
    window.setTimeout(() => setCopied(null), 1800);
  };

  const revertDraft = () => {
    const restored = mergeOverlayTemplatesConfig(overlayTemplates);
    setDraft(restored);
    const exists = kind === 'lyrics'
      ? restored.lyricsDesigns.some(design => design.id === selectedDesignId)
      : restored.setlistDesigns.some(design => design.id === selectedDesignId);
    setSelectedDesignId(exists ? selectedDesignId : (kind === 'lyrics' ? restored.activeLyricsDesignId : restored.activeSetlistDesignId));
  };

  const resetDesign = () => {
    if (kind === 'lyrics') {
      updateLyricsDesign(design => ({
        ...design,
        config: createDefaultLyricsConfig(),
      }));
    } else {
      updateSetlistDesign(design => ({
        ...design,
        config: createDefaultSetlistConfig(design.config.templateId),
      }));
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`http://localhost:10001/obs/${kind}?design=${encodeURIComponent(selectedDesign.id)}`);
    setCopied(kind === 'lyrics' ? '已複製歌詞 OBS 連結' : '已複製歌單 OBS 連結');
    window.setTimeout(() => setCopied(null), 1600);
  };

  const resetSetlistPreview = () => {
    setSetlistPreviewIndex(0);
    setSetlistPreviewWaiting(setlistPreviewMode === 'stream');
  };

  const moveSetlistPreview = (direction: -1 | 1) => {
    if (setlistPreviewMode !== 'stream') {
      setSetlistPreviewWaiting(false);
      setSetlistPreviewIndex(prev => Math.max(0, Math.min(SAMPLE_SETLIST_STATE.queue.length - 1, prev + direction)));
      return;
    }

    if (direction < 0) {
      setSetlistPreviewWaiting(false);
      setSetlistPreviewIndex(prev => Math.max(0, prev - 1));
      return;
    }

    if (setlistPreviewWaiting) {
      setSetlistPreviewWaiting(false);
      return;
    }

    setSetlistPreviewWaiting(true);
    setSetlistPreviewIndex(prev => Math.min(SAMPLE_SETLIST_STATE.queue.length, prev + 1));
  };

  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 14,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 5 }}>
            設定 &gt; 直播覆蓋模板 &gt; {kind === 'lyrics' ? '歌詞覆蓋' : '歌單覆蓋'} &gt; {selectedDesign.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {kind === 'lyrics' ? '歌詞覆蓋編輯器' : '歌單覆蓋編輯器'}
            </h2>
            <div ref={designMenuRef} style={{ position: 'relative', minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setDesignMenuOpen(open => !open)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  maxWidth: 280,
                  minWidth: 0,
                  padding: '7px 10px',
                  borderRadius: 999,
                  border: BORDER,
                  background: designMenuOpen ? '#303030' : PANEL_BG,
                  color: '#ddd',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: '#999', flex: '0 0 auto' }}>設計</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDesign.name}</span>
                <span style={{ color: '#aaa', flex: '0 0 auto' }}>⌄</span>
              </button>
              {designMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: 280,
                    maxWidth: 'calc(100vw - 48px)',
                    background: '#242424',
                    border: BORDER,
                    borderRadius: 12,
                    padding: 8,
                    boxShadow: '0 16px 38px rgba(0,0,0,0.42)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {designs.map(design => (
                      <button
                        key={design.id}
                        type="button"
                        onClick={() => selectDesignFromMenu(design.id)}
                        style={{
                          background: design.id === selectedDesign.id ? 'rgba(var(--accent-color-rgb), 0.18)' : 'transparent',
                          border: design.id === selectedDesign.id ? '1px solid var(--accent-color)' : '1px solid transparent',
                          color: design.id === selectedDesign.id ? '#fff' : '#bbb',
                          borderRadius: 8,
                          padding: '8px 9px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          fontWeight: design.id === selectedDesign.id ? 800 : 600,
                        }}
                      >
                        {design.name}
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid #383838', marginTop: 8, paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <SmallButton onClick={addDesignFromMenu}>新增</SmallButton>
                    <SmallButton onClick={duplicateDesignFromMenu}>複製</SmallButton>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SmallButton onClick={deleteDesignFromMenu} disabled={designs.length <= 1 || selectedDesign.id === 'default'} danger>刪除目前設計</SmallButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {copied && <span style={{ color: 'var(--accent-color)', fontSize: 12 }}>{copied}</span>}
          <SmallButton onClick={saveDraft} primary disabled={!isDirty}>儲存</SmallButton>
          <SmallButton onClick={revertDraft} disabled={!isDirty}>還原</SmallButton>
          <SmallButton onClick={resetDesign}>重設此設計</SmallButton>
          <SmallButton onClick={onClose}>返回</SmallButton>
        </div>
      </div>

      <div ref={editorViewportRef} style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateAreas: '"preview inspector"',
        gridTemplateColumns: editorGridColumns,
        gridTemplateRows: 'minmax(0, 1fr)',
        gap: editorGap,
        alignItems: 'stretch',
        minWidth: 0,
      }}>
          <div style={{
            ...editorPanelStyle,
            gridArea: 'preview',
            padding: editorPanelPadding,
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
              {kind === 'lyrics' ? (
                <>
                  <div style={{ color: '#aaa', fontSize: 12 }}>範例日文歌詞預覽</div>
                  <LyricsPreviewControls
                    playing={lyricsPreviewPlaying}
                    onToggle={() => setLyricsPreviewPlaying(prev => !prev)}
                    time={lyricsPreviewTime}
                    duration={lyricsDuration}
                    onTimeChange={setLyricsPreviewTime}
                  />
                </>
              ) : (
                <>
                  <SegmentedControl
                    value={setlistPreviewDataMode}
                    options={[['sample', '範例資料'], ['current', '目前佇列']]}
                    onChange={(value) => setSetlistPreviewDataMode(value as 'sample' | 'current')}
                  />
                  <SetlistPreviewControls
                    mode={setlistPreviewMode}
                    disabled={setlistPreviewDataMode === 'current'}
                    onModeChange={(mode) => {
                      setSetlistPreviewMode(mode);
                      setSetlistPreviewWaiting(mode === 'stream');
                      if (mode === 'normal') {
                        setSetlistPreviewIndex(prev => Math.min(prev, SAMPLE_SETLIST_STATE.queue.length - 1));
                      }
                    }}
                    onPrev={() => moveSetlistPreview(-1)}
                    onNext={() => moveSetlistPreview(1)}
                    onReset={resetSetlistPreview}
                  />
                </>
              )}
            </div>
            <div style={{
              flex: 1,
              minHeight: 0,
              borderRadius: 12,
              border: '1px solid #444',
              backgroundImage: 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              backgroundColor: '#1b1b1b',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}>
              <PreviewStage>
                {kind === 'lyrics' ? (
                  <TemplatedLyricsOverlay
                    design={selectedLyricsDesign}
                    status={lyricsPreview.status}
                    lines={lyricsPreview.lines}
                    currentTime={lyricsPreviewTime}
                    enrichedLines={lyricsPreview.enrichedLines}
                    furiganaEnabled={true}
                    romajiEnabled={true}
                  />
                ) : (
                  <TemplatedSetlistOverlay design={selectedSetlistDesign} state={previewSetlistState} preview />
                )}
              </PreviewStage>
            </div>
          </div>

          <div style={{ ...editorPanelStyle, gridArea: 'inspector', padding: editorPanelPadding }}>
            <input
              value={selectedDesign.name}
              onChange={(event) => updateName(event.target.value)}
              style={{ ...fieldStyle, width: '100%', maxWidth: 'none', marginBottom: 12 }}
            />

            {kind === 'lyrics' ? (
              <LyricsInspector design={selectedLyricsDesign} fonts={fonts} onChange={updateLyricsDesign} />
            ) : (
              <SetlistInspector design={selectedSetlistDesign} fonts={fonts} onChange={updateSetlistDesign} />
            )}

            <ControlGroup title="OBS 連結">
              <SmallButton onClick={copyLink}>{kind === 'lyrics' ? '複製歌詞 OBS 連結' : '複製歌單 OBS 連結'}</SmallButton>
              <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>
                儲存後 OBS 來源會更新；連結會固定指向此設計 ID。
              </div>
            </ControlGroup>
          </div>
        </div>
      </div>
  );
};

const LyricsInspector: React.FC<{
  design: LyricsOverlayDesign;
  fonts: string[];
  onChange: (recipe: (design: LyricsOverlayDesign) => LyricsOverlayDesign) => void;
}> = ({ design, fonts, onChange }) => {
  const config = design.config;
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange(current => ({ ...current, config: { ...current.config, ...updates } }));
  };

  return (
    <>
      <ControlGroup title="歌詞">
        <SelectControl label="字體" value={config.fontFamily} onChange={(fontFamily) => updateConfig({ fontFamily })} options={fonts.map(font => [font, font.replace(/["]/g, '').split(',')[0]])} />
        <CheckboxControl label="填滿高度" checked={config.lineMode === 'fill'} onChange={(checked) => updateConfig({ lineMode: checked ? 'fill' : 'count' })} />
        <NumberControl label="顯示行數" min={1} max={15} value={config.lineCount} disabled={config.lineMode === 'fill'} onChange={(lineCount) => updateConfig({ lineCount })} />
        <SelectControl label="動畫" value={config.animation} onChange={(animation) => updateConfig({ animation: animation as any })} options={[['scroll', '滑動'], ['none', '無'], ['fade', '淡入'], ['slide', '滑入'], ['scale', '縮放']]} />
        <RangeControl label="高亮大小" min={20} max={96} value={config.activeFontSize} onChange={(activeFontSize) => updateConfig({ activeFontSize })} />
        <RangeControl label="一般大小" min={16} max={72} value={config.inactiveFontSize} onChange={(inactiveFontSize) => updateConfig({ inactiveFontSize })} />
        <RangeControl label="行距" min={0} max={80} value={config.lineGap} onChange={(lineGap) => updateConfig({ lineGap })} />
        <RangeControl label="字距" min={0} max={16} value={config.letterSpacing} onChange={(letterSpacing) => updateConfig({ letterSpacing })} />
      </ControlGroup>

      <ControlGroup title="顏色與可讀性">
        <ColorControl label="高亮色" value={config.activeColor} onChange={(activeColor) => updateConfig({ activeColor })} />
        <ColorControl label="一般色" value={config.inactiveColor} onChange={(inactiveColor) => updateConfig({ inactiveColor })} />
        <ColorControl label="已唱色" value={config.passedColor} onChange={(passedColor) => updateConfig({ passedColor })} />
        <ColorControl label="描邊色" value={config.strokeColor} onChange={(strokeColor) => updateConfig({ strokeColor })} />
        <RangeControl label="描邊粗細" min={0} max={8} value={config.strokeWidth} onChange={(strokeWidth) => updateConfig({ strokeWidth })} />
        <ColorControl label="發光色" value={config.glowColor.startsWith('#') ? config.glowColor : '#ff4444'} onChange={(glowColor) => updateConfig({ glowColor })} />
        <RangeControl label="發光強度" min={0} max={1} step={0.05} value={config.glowStrength} onChange={(glowStrength) => updateConfig({ glowStrength })} />
      </ControlGroup>

      <ControlGroup title="日文輔助">
        <SelectControl label="注音" value={config.furiganaPolicy} onChange={(furiganaPolicy) => updateConfig({ furiganaPolicy: furiganaPolicy as any })} options={[['follow_app', '跟隨 App'], ['show', '顯示'], ['hide', '隱藏']]} />
        <SelectControl label="羅馬字" value={config.romajiPolicy} onChange={(romajiPolicy) => updateConfig({ romajiPolicy: romajiPolicy as any })} options={[['follow_app', '跟隨 App'], ['show', '顯示'], ['hide', '隱藏']]} />
        {config.romajiPolicy !== 'hide' && (
          <>
            <RangeControl label="羅馬字間距" min={0} max={16} value={config.romajiLetterSpacing} onChange={(romajiLetterSpacing) => updateConfig({ romajiLetterSpacing })} />
            <RangeControl label="羅馬字上方距離" min={-20} max={40} value={config.romajiMarginTop} onChange={(romajiMarginTop) => updateConfig({ romajiMarginTop })} />
          </>
        )}
      </ControlGroup>
    </>
  );
};

const SETLIST_TEMPLATE_CAPABILITIES: Record<SetlistTemplateId, {
  currentControl: boolean;
  upcomingControl: boolean;
  history: boolean;
  counts: boolean;
  numbering: boolean;
  thumbnails: boolean;
  density: boolean;
  frame: boolean;
  scrolling: boolean;
  gridColumns: boolean;
  templateOptions: 'pager' | 'cassette' | 'stage' | 'photo' | 'vertical' | 'disk' | 'graphic' | null;
}> = {
  classic_list: {
    currentControl: true,
    upcomingControl: true,
    history: true,
    counts: true,
    numbering: true,
    thumbnails: true,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: null,
  },
  record_card: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: true,
    numbering: false,
    thumbnails: true,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: null,
  },
  compact_strip: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: true,
    numbering: false,
    thumbnails: true,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: null,
  },
  neon_signboard: {
    currentControl: true,
    upcomingControl: true,
    history: true,
    counts: true,
    numbering: true,
    thumbnails: false,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: null,
  },
  countdown_counter: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: true,
    numbering: true,
    thumbnails: false,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: null,
  },
  index_grid: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: true,
    numbering: true,
    thumbnails: false,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: true,
    templateOptions: null,
  },
  pager_console: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: false,
    numbering: true,
    thumbnails: false,
    density: false,
    frame: false,
    scrolling: true,
    gridColumns: false,
    templateOptions: 'pager',
  },
  cassette_deck: {
    currentControl: false,
    upcomingControl: false,
    history: false,
    counts: false,
    numbering: false,
    thumbnails: true,
    density: false,
    frame: false,
    scrolling: false,
    gridColumns: false,
    templateOptions: 'cassette',
  },
  stage_marquee: {
    currentControl: true,
    upcomingControl: true,
    history: true,
    counts: true,
    numbering: true,
    thumbnails: false,
    density: true,
    frame: true,
    scrolling: true,
    gridColumns: false,
    templateOptions: 'stage',
  },
  photo_stack: {
    currentControl: false,
    upcomingControl: false,
    history: false,
    counts: false,
    numbering: false,
    thumbnails: true,
    density: false,
    frame: false,
    scrolling: false,
    gridColumns: false,
    templateOptions: 'photo',
  },
  vertical_column: {
    currentControl: true,
    upcomingControl: true,
    history: false,
    counts: false,
    numbering: false,
    thumbnails: false,
    density: false,
    frame: false,
    scrolling: true,
    gridColumns: false,
    templateOptions: 'vertical',
  },
  spinning_disk_list: {
    currentControl: false,
    upcomingControl: false,
    history: true,
    counts: false,
    numbering: false,
    thumbnails: false,
    density: false,
    frame: false,
    scrolling: true,
    gridColumns: false,
    templateOptions: 'disk',
  },
};

const SetlistInspector: React.FC<{
  design: SetlistOverlayDesign;
  fonts: string[];
  onChange: (recipe: (design: SetlistOverlayDesign) => SetlistOverlayDesign) => void;
}> = ({ design, fonts, onChange }) => {
  const config = design.config;
  const capabilities = SETLIST_TEMPLATE_CAPABILITIES[config.templateId];
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange(current => ({ ...current, config: { ...current.config, ...updates } }));
  };
  const updateTemplateOptions = (updates: Partial<typeof config.templateOptions>) => {
    onChange(current => ({
      ...current,
      config: {
        ...current.config,
        templateOptions: { ...current.config.templateOptions, ...updates },
      },
    }));
  };
  const applyTemplate = (templateId: SetlistTemplateId) => {
    onChange(current => ({
      ...current,
      config: {
        ...createDefaultSetlistConfig(templateId),
        fontFamily: current.config.fontFamily,
      },
    }));
  };
  const applyPreset = (presetId: string) => {
    onChange(current => {
      const preset = getSetlistTemplatePreset(current.config.templateId, presetId);
      const { templateOptions: presetTemplateOptions, ...presetDefaults } = preset.defaults;
      const {
        currentLabel,
        upcomingLabel,
        historyLabel,
        showCurrent,
        showUpcoming,
        showHistory,
      } = current.config;
      return {
        ...current,
        config: {
          ...current.config,
          ...presetDefaults,
          templateId: current.config.templateId,
          presetId: preset.id,
          templateOptions: {
            ...current.config.templateOptions,
            ...presetTemplateOptions,
          },
          currentLabel,
          upcomingLabel,
          historyLabel,
          showCurrent,
          showUpcoming,
          showHistory,
        },
      };
    });
  };

  return (
    <>
      <ControlGroup title="歌單">
        <SelectControl label="樣式" value={config.templateId} onChange={(value) => applyTemplate(value as SetlistTemplateId)} options={Object.entries(SETLIST_TEMPLATE_LABELS)} />
        <SelectControl label="外觀預設" value={config.presetId} onChange={applyPreset} options={SETLIST_TEMPLATE_PRESETS[config.templateId].map(preset => [preset.id, preset.label])} />
        <SelectControl label="字體" value={config.fontFamily} onChange={(fontFamily) => updateConfig({ fontFamily })} options={fonts.map(font => [font, font.replace(/["]/g, '').split(',')[0]])} />
        <ColorControl label="主色" value={config.accentColor} onChange={(accentColor) => updateConfig({ accentColor })} />
        <ColorControl label="文字色" value={config.textColor} onChange={(textColor) => updateConfig({ textColor })} />
        <ColorControl label="次要文字" value={config.secondaryColor} onChange={(secondaryColor) => updateConfig({ secondaryColor })} />
      </ControlGroup>

      <ControlGroup title="顯示內容">
        {capabilities.currentControl && (
          <CheckboxControl label="目前歌曲" checked={config.showCurrent} onChange={(showCurrent) => updateConfig({ showCurrent })} />
        )}
        {capabilities.upcomingControl && (
          <CheckboxControl label={config.templateId === 'pager_console' ? '底部跑馬' : '待播'} checked={config.showUpcoming} onChange={(showUpcoming) => updateConfig({ showUpcoming })} />
        )}
        {capabilities.history && (
          <CheckboxControl label="已唱" checked={config.showHistory} onChange={(showHistory) => updateConfig({ showHistory })} />
        )}
        {capabilities.counts && (
          <CheckboxControl label="數量" checked={config.showCounts} onChange={(showCounts) => updateConfig({ showCounts })} />
        )}
        <CheckboxControl label="歌手" checked={config.showArtist} onChange={(showArtist) => updateConfig({ showArtist })} />
        {capabilities.numbering && (
          <CheckboxControl label="編號" checked={config.showNumbering} onChange={(showNumbering) => updateConfig({ showNumbering })} />
        )}
        {capabilities.thumbnails && (
          <CheckboxControl label="縮圖" checked={config.showThumbnails} onChange={(showThumbnails) => updateConfig({ showThumbnails })} />
        )}
        <CheckboxControl label="時長" checked={config.showDuration} onChange={(showDuration) => updateConfig({ showDuration })} />
      </ControlGroup>

      <ControlGroup title="標籤與動態">
        <TextControl label="目前" value={config.currentLabel} onChange={(currentLabel) => updateConfig({ currentLabel })} />
        {capabilities.upcomingControl && (
          <TextControl label={config.templateId === 'pager_console' ? '待播跑馬標籤' : '待播'} value={config.upcomingLabel} onChange={(upcomingLabel) => updateConfig({ upcomingLabel })} />
        )}
        {capabilities.history && config.templateId !== 'spinning_disk_list' && (
          <TextControl label="已唱" value={config.historyLabel} onChange={(historyLabel) => updateConfig({ historyLabel })} />
        )}
        {capabilities.density && (
          <SelectControl label="密度" value={config.density} onChange={(density) => updateConfig({ density: density as any })} options={[['compact', '緊湊'], ['comfortable', '舒適']]} />
        )}
        {capabilities.frame && (
          <>
            <SelectControl label="外框" value={config.frameStyle} onChange={(frameStyle) => updateConfig({ frameStyle: frameStyle as any })} options={[['solid', '實色'], ['glass', '玻璃'], ['neon', '霓虹']]} />
            <RangeControl label="外框圓角" min={0} max={48} value={config.outerRadius} onChange={(outerRadius) => updateConfig({ outerRadius })} />
            <RangeControl label="內部項目圓角" min={0} max={32} value={config.innerRadius} onChange={(innerRadius) => updateConfig({ innerRadius })} />
          </>
        )}
        {capabilities.gridColumns && (
          <RangeControl label="欄數" min={2} max={6} value={config.gridColumns} onChange={(gridColumns) => updateConfig({ gridColumns })} />
        )}
        {capabilities.templateOptions === 'graphic' && (
          <>
            <RangeControl label="裝飾強度" min={0} max={1} step={0.05} value={config.templateOptions.decorationIntensity} displayValue={`${Math.round(config.templateOptions.decorationIntensity * 100)}%`} onChange={(decorationIntensity) => updateTemplateOptions({ decorationIntensity })} />
            <RangeControl label="材質紋理" min={0} max={1} step={0.05} value={config.templateOptions.textureOpacity} displayValue={`${Math.round(config.templateOptions.textureOpacity * 100)}%`} onChange={(textureOpacity) => updateTemplateOptions({ textureOpacity })} />
            <SelectControl label="裝飾動態" value={config.templateOptions.motionDetail} onChange={(motionDetail) => updateTemplateOptions({ motionDetail: motionDetail as any })} options={[['off', '關閉'], ['subtle', '細緻'], ['full', '完整']]} />
          </>
        )}
        {capabilities.templateOptions === 'pager' && (
          <>
            <SelectControl label="文字效果" value={config.templateOptions.textEffect} onChange={(textEffect) => updateTemplateOptions({ textEffect: textEffect as any })} options={[['normal', '一般'], ['lcd', 'LCD'], ['pixel', '像素感']]} />
            <SelectControl label="跑馬內容" value={config.templateOptions.tickerSource} onChange={(tickerSource) => updateTemplateOptions({ tickerSource: tickerSource as any })} options={[['upcoming', '待播清單'], ['history', '已唱清單']]} />
            {config.templateOptions.tickerSource === 'history' && (
              <TextControl label="已唱跑馬標籤" value={config.historyLabel} onChange={(historyLabel) => updateConfig({ historyLabel })} />
            )}
            <TextControl label="左下文字" value={config.templateOptions.footerLabel} onChange={(footerLabel) => updateTemplateOptions({ footerLabel })} />
            <RangeControl label="跑馬速度" min={1} max={10} value={config.templateOptions.tickerSpeed} onChange={(tickerSpeed) => updateTemplateOptions({ tickerSpeed })} />
            <RangeControl label="材質紋理" min={0} max={1} step={0.05} value={config.templateOptions.textureOpacity} displayValue={`${Math.round(config.templateOptions.textureOpacity * 100)}%`} onChange={(textureOpacity) => updateTemplateOptions({ textureOpacity })} />
          </>
        )}
        {capabilities.templateOptions === 'cassette' && (
          <>
            <RangeControl label="卡帶深度" min={0} max={1} step={0.05} value={config.templateOptions.cassetteDepth} displayValue={`${Math.round(config.templateOptions.cassetteDepth * 100)}%`} onChange={(cassetteDepth) => updateTemplateOptions({ cassetteDepth })} />
            <RangeControl label="材質紋理" min={0} max={1} step={0.05} value={config.templateOptions.textureOpacity} displayValue={`${Math.round(config.templateOptions.textureOpacity * 100)}%`} onChange={(textureOpacity) => updateTemplateOptions({ textureOpacity })} />
            <SelectControl label="轉盤動畫" value={config.templateOptions.diskSpinMode} onChange={(diskSpinMode) => updateTemplateOptions({ diskSpinMode: diskSpinMode as any })} options={[['off', '關閉'], ['current', '旋轉'], ['all', '旋轉']]} />
            <RangeControl label="轉盤速度" min={1} max={10} value={config.templateOptions.diskSpinSpeed} onChange={(diskSpinSpeed) => updateTemplateOptions({ diskSpinSpeed })} />
          </>
        )}
        {capabilities.templateOptions === 'stage' && (
          <>
            <SelectControl label="燈光動畫" value={config.templateOptions.lightAnimation} onChange={(lightAnimation) => updateTemplateOptions({ lightAnimation: lightAnimation as any })} options={[['off', '關閉'], ['breathe', '呼吸'], ['flash', '閃爍'], ['chase', '追光'], ['rainbow', '彩虹']]} />
            <SelectControl label="燈光色" value={config.templateOptions.lightPalette} onChange={(lightPalette) => updateTemplateOptions({ lightPalette: lightPalette as any })} options={[['accent', '主色'], ['warm', '暖色'], ['cool', '冷色'], ['rainbow', '彩虹']]} />
            <RangeControl label="燈光速度" min={1} max={10} value={config.templateOptions.tickerSpeed} onChange={(tickerSpeed) => updateTemplateOptions({ tickerSpeed })} />
            <RangeControl label="裝飾強度" min={0} max={1} step={0.05} value={config.templateOptions.decorationIntensity} displayValue={`${Math.round(config.templateOptions.decorationIntensity * 100)}%`} onChange={(decorationIntensity) => updateTemplateOptions({ decorationIntensity })} />
          </>
        )}
        {capabilities.templateOptions === 'photo' && (
          <>
            <RangeControl label="相框質感" min={0} max={1} step={0.05} value={config.templateOptions.textureOpacity} displayValue={`${Math.round(config.templateOptions.textureOpacity * 100)}%`} onChange={(textureOpacity) => updateTemplateOptions({ textureOpacity })} />
            <RangeControl label="卡片角度" min={0} max={1} step={0.05} value={config.templateOptions.decorationIntensity} displayValue={`${Math.round(config.templateOptions.decorationIntensity * 100)}%`} onChange={(decorationIntensity) => updateTemplateOptions({ decorationIntensity })} />
            <SelectControl label="滑卡動畫" value={config.templateOptions.cardTransition} onChange={(cardTransition) => updateTemplateOptions({ cardTransition: cardTransition as any })} options={[['slide', '開啟'], ['none', '關閉']]} />
            <RangeControl label="目前發光" min={0} max={1} step={0.05} value={config.templateOptions.currentGlow} displayValue={`${Math.round(config.templateOptions.currentGlow * 100)}%`} onChange={(currentGlow) => updateTemplateOptions({ currentGlow })} />
            <ColorControl label="音符色" value={config.templateOptions.noteColor} onChange={(noteColor) => updateTemplateOptions({ noteColor })} />
          </>
        )}
        {capabilities.templateOptions === 'vertical' && (
          <>
            <RangeControl label="左右留白" min={0} max={28} value={config.templateOptions.contentInset} displayValue={`${config.templateOptions.contentInset}%`} onChange={(contentInset) => updateTemplateOptions({ contentInset })} />
            <RangeControl label="頂部位置" min={0} max={70} value={config.templateOptions.topOffset} displayValue={`${config.templateOptions.topOffset}%`} onChange={(topOffset) => updateTemplateOptions({ topOffset })} />
            <RangeControl label="項目間距" min={0} max={28} value={config.templateOptions.rowGap} onChange={(rowGap) => updateTemplateOptions({ rowGap })} />
            <RangeControl label="標題底色" min={0} max={1} step={0.05} value={config.templateOptions.titleBarOpacity} displayValue={`${Math.round(config.templateOptions.titleBarOpacity * 100)}%`} onChange={(titleBarOpacity) => updateTemplateOptions({ titleBarOpacity })} />
            <RangeControl label="分隔線" min={0} max={1} step={0.05} value={config.templateOptions.dividerOpacity} displayValue={`${Math.round(config.templateOptions.dividerOpacity * 100)}%`} onChange={(dividerOpacity) => updateTemplateOptions({ dividerOpacity })} />
            <RangeControl label="目前字級" min={14} max={54} value={config.templateOptions.currentFontSize} onChange={(currentFontSize) => updateTemplateOptions({ currentFontSize })} />
            <RangeControl label="待播字級" min={9} max={28} value={config.templateOptions.reserveFontSize} onChange={(reserveFontSize) => updateTemplateOptions({ reserveFontSize })} />
          </>
        )}
        {capabilities.templateOptions === 'disk' && (
          <>
            <RangeControl label="列間距" min={0} max={28} value={config.templateOptions.rowGap} onChange={(rowGap) => updateTemplateOptions({ rowGap })} />
            <RangeControl label="已唱透明度" min={0.1} max={1} step={0.05} value={config.templateOptions.rowOpacity} displayValue={`${Math.round(config.templateOptions.rowOpacity * 100)}%`} onChange={(rowOpacity) => updateTemplateOptions({ rowOpacity })} />
            <RangeControl label="目前發光" min={0} max={1} step={0.05} value={config.templateOptions.currentGlow} displayValue={`${Math.round(config.templateOptions.currentGlow * 100)}%`} onChange={(currentGlow) => updateTemplateOptions({ currentGlow })} />
            <RangeControl label="圓盤大小" min={16} max={64} value={config.templateOptions.diskSize} onChange={(diskSize) => updateTemplateOptions({ diskSize })} />
            <SelectControl label="圓盤樣式" value={config.templateOptions.diskStyle} onChange={(diskStyle) => updateTemplateOptions({ diskStyle: diskStyle as any })} options={[['vinyl', '唱片'], ['thumbnail', '縮圖'], ['ring', '圓環'], ['dot', '圓點']]} />
            {config.templateOptions.diskStyle === 'thumbnail' && (
              <RangeControl label="縮圖邊框" min={0} max={8} value={config.templateOptions.diskBorderWidth} displayValue={`${config.templateOptions.diskBorderWidth}px`} onChange={(diskBorderWidth) => updateTemplateOptions({ diskBorderWidth })} />
            )}
            <SelectControl label="旋轉" value={config.templateOptions.diskSpinMode} onChange={(diskSpinMode) => updateTemplateOptions({ diskSpinMode: diskSpinMode as any })} options={[['off', '關閉'], ['current', '目前歌曲'], ['all', '全部']]} />
            <RangeControl label="旋轉速度" min={1} max={10} value={config.templateOptions.diskSpinSpeed} onChange={(diskSpinSpeed) => updateTemplateOptions({ diskSpinSpeed })} />
          </>
        )}
        {capabilities.scrolling && (
          <>
            <CheckboxControl label="清單滾動" checked={config.autoScroll} onChange={(autoScroll) => updateConfig({ autoScroll })} />
            <RangeControl label="滾動速度" min={1} max={10} value={config.autoScrollSpeed} onChange={(autoScrollSpeed) => updateConfig({ autoScrollSpeed })} />
            <RangeControl
              label="停留時間"
              min={0}
              max={5}
              step={0.1}
              value={Number((config.autoScrollPauseMs / 1000).toFixed(1))}
              displayValue={`${(config.autoScrollPauseMs / 1000).toFixed(1)}s`}
              onChange={(seconds) => updateConfig({ autoScrollPauseMs: Math.round(seconds * 1000) })}
            />
          </>
        )}
        <SelectControl label="換歌動畫" value={config.changeAnimation} onChange={(changeAnimation) => updateConfig({ changeAnimation: changeAnimation as any })} options={[['none', '無'], ['fade', '淡入'], ['slide', '滑入']]} />
        <SelectControl label="空狀態" value={config.emptyState} onChange={(emptyState) => updateConfig({ emptyState: emptyState as any })} options={[['waiting', '顯示等待文字'], ['hide', '隱藏']]} />
        <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>
          沒有目前歌曲時的 Now Singing 顯示方式；即使隱藏，也會保留區塊避免歌單往上跳。
        </div>
        {config.emptyState === 'waiting' && (
          <>
            <TextControl label="等待文字" value={config.waitingText} onChange={(waitingText) => updateConfig({ waitingText })} />
            <CheckboxControl label="顯示待播歌名" checked={config.showWaitingSongTitle} onChange={(showWaitingSongTitle) => updateConfig({ showWaitingSongTitle })} />
          </>
        )}
      </ControlGroup>
    </>
  );
};

const PreviewStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const updateSize = () => setFrameSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = frameSize.width > 0 && frameSize.height > 0
    ? Math.min(frameSize.width / PREVIEW_CANVAS_WIDTH, frameSize.height / PREVIEW_CANVAS_HEIGHT)
    : 0.5;
  const scaledWidth = PREVIEW_CANVAS_WIDTH * scale;
  const scaledHeight = PREVIEW_CANVAS_HEIGHT * scale;

  return (
    <div
      ref={frameRef}
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
      >
        <div
          style={{
            width: PREVIEW_CANVAS_WIDTH,
            height: PREVIEW_CANVAS_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const LyricsPreviewControls: React.FC<{
  playing: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onTimeChange: (time: number) => void;
}> = ({ playing, time, duration, onToggle, onTimeChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 230px' }}>
    <SmallButton onClick={onToggle}>{playing ? '暫停預覽' : '播放預覽'}</SmallButton>
    <input type="range" min={0} max={duration} step={0.1} value={Math.min(time, duration)} onChange={(event) => onTimeChange(Number(event.target.value))} style={{ flex: '1 1 120px', minWidth: 80, accentColor: 'var(--accent-color)' }} />
    <span style={{ color: '#aaa', fontSize: 12, width: 40, textAlign: 'right' }}>{formatTime(time)}</span>
  </div>
);

const SetlistPreviewControls: React.FC<{
  mode: 'normal' | 'stream';
  disabled: boolean;
  onModeChange: (mode: 'normal' | 'stream') => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}> = ({ mode, disabled, onModeChange, onPrev, onNext, onReset }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto', flexWrap: 'wrap', minWidth: 0 }}>
    <SegmentedControl
      value={mode}
      options={[['normal', '一般模式'], ['stream', '直播模式']]}
      onChange={(value) => onModeChange(value as 'normal' | 'stream')}
    />
    <PreviewIconButton icon={PrevIcon} title="預覽上一首" onClick={onPrev} />
    <PreviewIconButton icon={NextIcon} title="預覽下一首" onClick={onNext} />
    <PreviewIconButton icon={ReplayIcon} title="重設預覽狀態" onClick={onReset} />
  </div>
);

const PreviewIconButton: React.FC<{ icon: string; title: string; onClick: () => void }> = ({ icon, title, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width: 28,
      height: 28,
      border: 'none',
      background: 'transparent',
      borderRadius: 6,
      padding: 5,
      cursor: 'pointer',
      opacity: 0.68,
      display: 'grid',
      placeItems: 'center',
      transition: 'opacity 160ms ease, background-color 160ms ease',
    }}
    onMouseEnter={(event) => {
      event.currentTarget.style.opacity = '1';
      event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
    }}
    onMouseLeave={(event) => {
      event.currentTarget.style.opacity = '0.68';
      event.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    <img src={icon} alt="" style={{ width: 16, height: 16, filter: 'brightness(0) invert(1)' }} />
  </button>
);

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const editorPanelStyle: React.CSSProperties = {
  background: CONTROL_BG,
  border: BORDER,
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h2 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#fff', borderLeft: '4px solid var(--accent-color)', paddingLeft: 12 }}>
    {title}
  </h2>
);

const ControlGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{title}</div>
    {children}
  </div>
);

const SmallButton: React.FC<{ children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; danger?: boolean }> = ({ children, onClick, primary, disabled, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      border: primary ? 'none' : BORDER,
      background: primary ? 'var(--accent-color)' : PANEL_BG,
      color: primary ? '#041014' : danger ? '#ff8b8b' : '#ddd',
      borderRadius: 8,
      padding: '8px 10px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      fontWeight: primary ? 800 : 600,
      fontSize: 13,
      whiteSpace: 'nowrap',
      minWidth: 0,
    }}
  >
    {children}
  </button>
);

const SegmentedControl: React.FC<{ value: string; options: [string, string][]; onChange: (value: string) => void }> = ({ value, options, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', background: '#202020', borderRadius: 999, padding: 3, border: BORDER, minWidth: 0 }}>
    {options.map(([optionValue, label]) => (
      <button
        key={optionValue}
        onClick={() => onChange(optionValue)}
        style={{
          border: 'none',
          borderRadius: 999,
          background: value === optionValue ? 'var(--accent-color)' : 'transparent',
          color: value === optionValue ? '#061014' : '#aaa',
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

const SelectControl: React.FC<{ label: string; value: string; options: [string, string][]; onChange: (value: string) => void }> = ({ label, value, options, onChange }) => (
  <label style={controlRowStyle}>
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} style={fieldStyle}>
      {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
    </select>
  </label>
);

const TextControl: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label style={controlRowStyle}>
    <span>{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} style={fieldStyle} />
  </label>
);

const NumberControl: React.FC<{ label: string; min: number; max: number; value: number; disabled?: boolean; onChange: (value: number) => void }> = ({ label, min, max, value, disabled, onChange }) => (
  <label style={{ ...controlRowStyle, opacity: disabled ? 0.45 : 1 }}>
    <span>{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
      style={{ ...fieldStyle, width: 82 }}
    />
  </label>
);

const RangeControl: React.FC<{ label: string; min: number; max: number; value: number; step?: number; displayValue?: string; onChange: (value: number) => void }> = ({ label, min, max, value, step = 1, displayValue, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#aaa', fontSize: 12, minWidth: 0 }}>
    <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span>{displayValue ?? value}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ accentColor: 'var(--accent-color)', width: '100%', minWidth: 0 }} />
  </label>
);

const ColorControl: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label style={controlRowStyle}>
    <span>{label}</span>
    <input type="color" value={value.startsWith('#') ? value : '#ffffff'} onChange={(event) => onChange(event.target.value)} style={{ width: 44, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', justifySelf: 'end' }} />
  </label>
);

const CheckboxControl: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
  <label style={controlRowStyle}>
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--accent-color)', justifySelf: 'end' }} />
  </label>
);

const controlRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(72px, 0.6fr) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  color: '#aaa',
  fontSize: 12,
  minWidth: 0,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 190,
  minWidth: 0,
  background: '#1d1d1d',
  color: '#fff',
  border: BORDER,
  borderRadius: 7,
  padding: '6px 8px',
  fontSize: 12,
  boxSizing: 'border-box',
};

export default OverlayTemplateSettingsSection;
