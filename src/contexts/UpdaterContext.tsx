import React, { createContext, useContext, useEffect, useState } from 'react';

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
export type UpdaterErrorCode = 'disk_full' | 'network' | 'install_failed' | 'unknown';

export interface UpdaterProgress {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
}

export interface UpdateInfo {
    version: string;
    files: unknown[];
    path: string;
    sha512: string;
    releaseName?: string;
    releaseNotes?: string | Array<{ note?: string }>;
    releaseDate: string;
}

export interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    progress: UpdaterProgress | null;
    error: string | null;
    errorCode?: UpdaterErrorCode | null;
    lastCheckTime: number | null;
}

interface UpdaterContextType extends UpdaterState {
    isPopupOpen: boolean;
    openUpdatePopup: () => void;
    closeUpdatePopup: () => void;
    checkForUpdates: (manual?: boolean) => void;
    downloadUpdate: () => void;
    installUpdate: () => void;
    openReleasePage: () => void;
    ignoreVersion: (version: string) => void;
    _debugSetState?: (state: Partial<UpdaterState> & { simulatedOutcome?: 'success' | 'fail' }) => void;
    _debugSimulateFlow?: (outcome: 'success' | 'fail', version?: string) => void;
}

const UpdaterContext = createContext<UpdaterContextType | null>(null);

export const UpdaterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<UpdaterState>({
        status: 'idle',
        updateInfo: null,
        progress: null,
        error: null,
        errorCode: null,
        lastCheckTime: null,
    });
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    useEffect(() => {
        if (!window.khelper?.updater) return;

        window.khelper.updater.getStatus().then((initialState: UpdaterState) => {
            if (initialState) {
                setState(initialState);
                if (initialState.status === 'error' && initialState.errorCode === 'install_failed') {
                    setIsPopupOpen(true);
                }
            }
        });

        const unsubStatus = window.khelper.updater.onStatus((newState: UpdaterState) => {
            setState(newState);
        });

        const unsubPopup = window.khelper.updater.onOpenPopup?.(() => {
            setIsPopupOpen(true);
        });

        return () => {
            unsubStatus?.();
            unsubPopup?.();
        };
    }, []);

    const openUpdatePopup = () => setIsPopupOpen(true);
    const closeUpdatePopup = () => setIsPopupOpen(false);

    const checkForUpdates = async () => {
        await window.khelper?.updater.check();
    };

    const openReleasePage = async () => {
        await window.khelper?.updater.openReleasePage();
    };

    const downloadUpdate = async () => {
        await window.khelper?.updater.download();
    };

    const installUpdate = async () => {
        await window.khelper?.updater.install();
    };

    const ignoreVersion = async (version: string) => {
        await window.khelper?.updater.ignore(version);
    };

    const _debugSetState = (newState: Partial<UpdaterState> & { simulatedOutcome?: 'success' | 'fail' }) => {
        if (import.meta.env.DEV) {
            const { simulatedOutcome, ...statePatch } = newState;
            setState(prev => ({ ...prev, ...statePatch }));
            void window.khelper?.updater.debugSetState?.(newState);
        }
    };

    const _debugSimulateFlow = (outcome: 'success' | 'fail', version?: string) => {
        if (import.meta.env.DEV) {
            void window.khelper?.updater.debugSimulateFlow?.({ outcome, version });
        }
    };

    return (
        <UpdaterContext.Provider value={{
            ...state,
            isPopupOpen,
            openUpdatePopup,
            closeUpdatePopup,
            checkForUpdates,
            downloadUpdate,
            installUpdate,
            openReleasePage,
            ignoreVersion,
            ...(import.meta.env.DEV ? { _debugSetState, _debugSimulateFlow } : {}),
        }}>
            {children}
        </UpdaterContext.Provider>
    );
};

export const useUpdater = () => {
    const context = useContext(UpdaterContext);
    if (!context) {
        throw new Error('useUpdater must be used within UpdaterProvider');
    }
    return context;
};
