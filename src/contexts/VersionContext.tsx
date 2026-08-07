import React, { createContext, useContext, useMemo } from 'react';
import { 
  CURRENT_ZENO_VERSION, 
  RELEASE_DATE, 
  GIT_TAG, 
  ZENO_VERSION_HISTORY, 
  VersionEntry, 
  getLatestVersion, 
  checkAndGetNewVersion, 
  markVersionAsSeen 
} from '../config/versionConfig';

interface VersionContextType {
  currentVersion: string;
  releaseDate: string;
  gitTag: string;
  versionHistory: VersionEntry[];
  latestVersion: VersionEntry;
  checkNewVersion: () => { isNew: boolean; version: VersionEntry };
  markSeen: (versionStr: string) => void;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(() => ({
    currentVersion: CURRENT_ZENO_VERSION,
    releaseDate: RELEASE_DATE,
    gitTag: GIT_TAG,
    versionHistory: ZENO_VERSION_HISTORY,
    latestVersion: getLatestVersion(),
    checkNewVersion: checkAndGetNewVersion,
    markSeen: markVersionAsSeen,
  }), []);

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = (): VersionContextType => {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
};
