export function getAssetBasePath(): string {
  if (typeof window === 'undefined') return '';

  const { hostname, pathname } = window.location;

  // 1. Detect GitHub Pages: <owner>.github.io/<repo>/...
  if (hostname.endsWith('github.io')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]}`;
    }
  }

  // 2. Explicit known repository / base path prefixes
  if (pathname.startsWith('/3dchat')) return '/3dchat';
  if (pathname.startsWith('/presidents')) return '/presidents';

  // 3. Vite BASE_URL if configured and non-root
  const viteBase = (import.meta as any).env?.BASE_URL;
  if (viteBase && viteBase !== './' && viteBase !== '/') {
    return viteBase.replace(/\/+$/, '');
  }

  return '';
}

export function getAssetUrl(relPath: string): string {
  const clean = relPath.replace(/^\//, '');
  if (typeof window === 'undefined') return `/${clean}`;

  const origin = window.location.origin;
  const basePath = getAssetBasePath();

  return `${origin}${basePath}/${clean}`;
}

