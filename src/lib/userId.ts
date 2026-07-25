export function getOrCreateUserId(): string {
  let uid = localStorage.getItem('zeno_user_id');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('zeno_user_id', uid);
  }
  return uid;
}
