// lib/instagram-utils.ts

export function extractInstagramPostId(url: string): string | null {
  // Suporta vários formatos de URL do Instagram
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export async function downloadImageFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao baixar imagem');
  }
  return await response.blob();
}

export function generateFileName(postId: string): string {
  const timestamp = Date.now();
  return `instagram-${postId}-${timestamp}.jpg`;
}