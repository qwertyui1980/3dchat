export function getAssetUrl(relPath: string): string {
  const clean = relPath.replace(/^\//, '');
  if (typeof window === 'undefined') return `/${clean}`;

  const origin = window.location.origin;
  const pathname = window.location.pathname;

  // Preserve repo basePath for GitHub Pages (/3dchat)
  const basePath = pathname.startsWith('/3dchat') ? '/3dchat' : '';

  return `${origin}${basePath}/${clean}`;
}
