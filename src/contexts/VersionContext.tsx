import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  CURRENT_ZENO_VERSION, 
  RELEASE_DATE, 
  GIT_TAG, 
  ZENO_VERSION_HISTORY, 
  VersionEntry, 
  getLatestVersion,
  checkAndGetNewVersion,
  markVersionAsSeen,
  fetchRemoteChangelog,
  hasRelevantContent
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
  const [remoteHistory, setRemoteHistory] = useState<VersionEntry[] | null>(null);

  useEffect(() => {
    // Fetch remote changelog so the modal is always up to date
    // Add cache-busting parameter to avoid stale CDN/browser cache
    fetch(`/changelog.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRemoteHistory(data);
        } else {
          setRemoteHistory(ZENO_VERSION_HISTORY);
        }
      })
      .catch(err => {
        console.warn('Falha silenciosa ao carregar changelog remoto:', err);
        setRemoteHistory(ZENO_VERSION_HISTORY);
      });
  }, []);

  const value = useMemo(() => {
    const historyToUse = remoteHistory || ZENO_VERSION_HISTORY;
    const latestVersion = remoteHistory ? remoteHistory[0] : getLatestVersion();

    const checkNewVersion = () => {
      if (remoteHistory === null) {
        // Return false while remote history is still fetching to avoid opening the modal in a transient state.
        return { isNew: false, version: latestVersion };
      }
      const lastSeen = localStorage.getItem('zeno_last_seen_version');
      const latestVer = latestVersion.version;
      const isNew = lastSeen !== latestVer;
      const relevant = hasRelevantContent(latestVersion);
      const finalIsNew = isNew && relevant;

      console.group('[Zeno Version Comparison Log]');
      console.log('localStorage ("zeno_last_seen_version"):', lastSeen);
      console.log('Latest Version in Config/Remote:', latestVer);
      console.log('Is version new (lastSeen !== latestVer):', isNew);
      console.log('hasRelevantContent(latestVersion):', relevant);
      console.log('Final isNew Result:', finalIsNew);
      console.groupEnd();

      return { isNew: finalIsNew, version: latestVersion };
    };

    return {
      currentVersion: CURRENT_ZENO_VERSION,
      releaseDate: RELEASE_DATE,
      gitTag: GIT_TAG,
      versionHistory: historyToUse,
      latestVersion,
      checkNewVersion,
      markSeen: markVersionAsSeen,
    };
  }, [remoteHistory]);

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
