import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import SongList from './SongList';
import { SongMeta } from '../../shared/songTypes';
import HistoryIcon from '../assets/icons/history.svg';

interface HistoryViewProps {
    onOpenLyrics?: (song: SongMeta) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onOpenLyrics }) => {
    const { t } = useTranslation();
    const { getSongById } = useLibrary();
    const { history, clearHistory } = useUserData();

    const historySongs = useMemo(() => {
        return history
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as SongMeta[];
    }, [history, getSongById]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={HistoryIcon} alt="" style={pageTitleIconStyle} />
                    {t('songManagement.historyTitle')}
                </h1>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    {t('songManagement.historyDescription')}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={historySongs}
                    context="recent"
                    listKey="recent"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage={t('songManagement.historyEmpty')}
                    moreActions={[
                        {
                            label: t('songManagement.clearHistory'),
                            danger: true,
                            onClick: () => {
                                if (confirm(t('songManagement.clearHistoryConfirm'))) {
                                    clearHistory();
                                }
                            },
                        },
                    ]}
                />
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

export default HistoryView;
