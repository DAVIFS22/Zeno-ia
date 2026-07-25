export function getOrCreateUserId(activeUid?: string | null): string {
  if (activeUid) {
    return activeUid;
  }
  let uid = localStorage.getItem('zeno_anon_user_id');
  if (!uid) {
    uid = 'anon_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('zeno_anon_user_id', uid);
  }
  return uid;
}

