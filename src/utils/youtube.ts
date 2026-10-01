/**
 * Utility functions for YouTube URL parsing, validation and metadata fetching
 */

export function extractYouTubeVideoId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;

  const trimmed = urlOrId.trim();

  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common patterns
  // 1. youtu.be/<id>
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // 2. youtube.com/watch?v=<id>
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // 3. youtube.com/embed/<id>
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // 4. youtube.com/shorts/<id>
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // 5. youtube.com/live/<id>
  const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  return null;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function fetchYouTubeVideoInfo(urlOrId: string): Promise<{
  videoId: string;
  title: string;
  thumbnailUrl: string;
  cleanUrl: string;
} | null> {
  const videoId = extractYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId);
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = `Video de YouTube (${videoId})`;

  try {
    const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        title = data.title;
      }
    }
  } catch (_) {
    // Fallback title on network failure or CORS
  }

  return {
    videoId,
    title,
    thumbnailUrl,
    cleanUrl,
  };
}
