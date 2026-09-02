const AUTH_KEY = 'dm-auth-session';

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

export function login(user, pass) {
  const validUser = import.meta.env.VITE_AUTH_USER || 'opsadmin';
  const validPass = import.meta.env.VITE_AUTH_PASS || 'disrupt2026';
  if (user === validUser && pass === validPass) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY);
}
