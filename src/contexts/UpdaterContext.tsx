
import React, { createContext, useContext, useEffect, useState } from 'react';

// Define types based on what we exposed
export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateInfo {
    version: string;
    files: any[];
    path: string;
    sha512: string;
    releaseName?: string;
    releaseNotes?: string | any[];
    releaseDate: string;
}

export interface ProgressInfo {
    total: number;
    delta: number;
    transferred: number;
    percent: number;
    bytesPerSecond: number;
}

interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    progress: ProgressInfo | null;
    error: string | null;
    lastCheckTime: number | null;
}

interface UpdaterContextType extends UpdaterState {
    checkForUpdates: (manual?: boolean) => void;
    downloadUpdate: () => void;
    quitAndInstall: () => void;
    ignoreVersion: (version: string) => void;
    _debugSetState?: (state: Partial<UpdaterState>) => void;
}

const UpdaterContext = createContext<UpdaterContextType | null>(null);

export const UpdaterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<UpdaterState>({
        status: 'idle',
        updateInfo: null,
        progress: null,
        error: null,
        lastCheckTime: null,
    });

    useEffect(() => {
        // Initial fetch
        if (window.khelper?.updater) {
            window.khelper.updater.getStatus().then(setState);

            // Subscribe
            const unsub = window.khelper.updater.onStatus((newState: UpdaterState) => {
                setState(newState);
            });
            return unsub;
        }
    }, []);

    const checkForUpdates = async () => {
        window.khelper?.updater.check();
    };

    const downloadUpdate = async () => {
        window.khelper?.updater.download();
    };

    const quitAndInstall = async () => {
        window.khelper?.updater.install();
    };

    const ignoreVersion = async (version: string) => {
        window.khelper?.updater.ignore(version);
    };

    const _debugSetState = (newState: Partial<UpdaterState>) => {
        if (import.meta.env.DEV) {
            setState(prev => ({ ...prev, ...newState }));
        }
    };

    // Logic to filter ignored version is handled in MAIN process (per MUST-1).
    // But we still need to know IF we should show the popup for "available".
    // Actually, Main process filters 'available' event if ignored.
    // So if status is 'available', we know it's not ignored (or forced via manual check).
    // So we don't need to filter here.

    return (
        <UpdaterContext.Provider value={{
            ...state,
            checkForUpdates,
            downloadUpdate,
            quitAndInstall,
            ignoreVersion,
            ...(import.meta.env.DEV ? { _debugSetState } : {})
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
