const SIDEBAR_KEY = 'vocalis_sidebar_collapsed';

export function getSidebarCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
}
