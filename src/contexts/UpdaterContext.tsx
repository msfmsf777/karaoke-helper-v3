
import React, { createContext, useContext, useEffect, useState } from 'react';

// Define types based on what we exposed
export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'error';

export interface UpdateInfo {
    version: string;
    files: any[];
    path: string;
    sha512: string;
    releaseName?: string;
    releaseNotes?: string | any[];
    releaseDate: string;
}

interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    error: string | null;
    lastCheckTime: number | null;
}

interface UpdaterContextType extends UpdaterState {
    checkForUpdates: (manual?: boolean) => void;
    openReleasePage: () => void;
    ignoreVersion: (version: string) => void;
    _debugSetState?: (state: Partial<UpdaterState>) => void;
}

const UpdaterContext = createContext<UpdaterContextType | null>(null);

export const UpdaterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<UpdaterState>({
        status: 'idle',
        updateInfo: null,
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

    const openReleasePage = async () => {
        window.khelper?.updater.openReleasePage();
    };

    const ignoreVersion = async (version: string) => {
        window.khelper?.updater.ignore(version);
    };

    const _debugSetState = (newState: Partial<UpdaterState>) => {
        if (import.meta.env.DEV) {
            setState(prev => ({ ...prev, ...newState }));
        }
    };

    return (
        <UpdaterContext.Provider value={{
            ...state,
            checkForUpdates,
            openReleasePage,
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
