import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserGamificationProfile, LEVELS, INITIAL_BADGES } from '../types/gamification';

export function calculateLevel(totalPoints: number): string {
  let currentTitle = LEVELS[0].name;
  for (const lvl of LEVELS) {
    if (totalPoints >= lvl.minPoints) {
      currentTitle = lvl.name;
    } else {
      break;
    }
  }
  return currentTitle;
}

export function getNextLevelInfo(totalPoints: number) {
  let currentIdx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalPoints >= LEVELS[i].minPoints) {
      currentIdx = i;
    } else {
      break;
    }
  }
  const currentLvl = LEVELS[currentIdx];
  const nextLvl = LEVELS[currentIdx + 1] || null;
  
  if (!nextLvl) {
    return {
      currentName: currentLvl.name,
      nextName: 'Nível Máximo',
      progressPercent: 100,
      pointsNeeded: 0,
      currentPoints: totalPoints
    };
  }

  const span = nextLvl.minPoints - currentLvl.minPoints;
  const earned = totalPoints - currentLvl.minPoints;
  const progressPercent = Math.min(100, Math.max(0, Math.round((earned / span) * 100)));

  return {
    currentName: currentLvl.name,
    nextName: nextLvl.name,
    progressPercent,
    pointsNeeded: nextLvl.minPoints - totalPoints,
    currentPoints: totalPoints
  };
}

export async function getUserGamificationProfile(userId: string): Promise<UserGamificationProfile | null> {
  if (!userId || userId === 'anonymous' || userId.startsWith('anon_') || userId === 'local_user') {
    return null;
  }

  try {
    const res = await fetch(`/api/gamification/profile?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.profile) {
        data.profile.currentLevel = calculateLevel(data.profile.totalPoints || 0);
        return data.profile as UserGamificationProfile;
      }
    }
  } catch (err) {
    console.warn('[Gamification] Error fetching profile from server:', err);
  }

  // Fallback to client Firestore read if API unreachable
  try {
    const docRef = doc(db, 'gamificationProfiles', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserGamificationProfile;
      data.currentLevel = calculateLevel(data.totalPoints || 0);
      return data;
    }
  } catch (e) {
    // Ignore read errors
  }

  return null;
}

export async function addPointsToUser(userId: string, pointsOrAction: number | string, statKey?: string): Promise<{ profile: UserGamificationProfile | null; leveledUp: boolean }> {
  if (!userId || userId === 'anonymous' || userId.startsWith('anon_') || userId === 'local_user') {
    return { profile: null, leveledUp: false };
  }

  const currentProfile = await getUserGamificationProfile(userId);
  const oldLevel = currentProfile ? currentProfile.currentLevel : 'Iniciante';

  const actionString = typeof pointsOrAction === 'string' ? pointsOrAction : 'message';

  try {
    const res = await fetch('/api/gamification/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: actionString, statKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.profile) {
        const profile = data.profile as UserGamificationProfile;
        profile.currentLevel = calculateLevel(profile.totalPoints || 0);
        const leveledUp = profile.currentLevel !== oldLevel;
        return { profile, leveledUp };
      }
    }
  } catch (err) {
    console.warn('[Gamification] Error awarding points via backend:', err);
  }

  return { profile: currentProfile, leveledUp: false };
}
