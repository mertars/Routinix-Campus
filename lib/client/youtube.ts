// Video Ders Merkezi — kullanıcı kararı (2026-09-03): videolar YouTube'da
// (gizli/liste dışı) barındırılıyor, biz SADECE embed ediyoruz — depolama/
// bant genişliği maliyeti yok, oynatma kalitesi YouTube'un kendi adaptif
// altyapısından geliyor (R2 + tarayıcı-içi dönüştürme denendi ama yavaş/
// tutarsız çıktı). youtube-nocookie.com domaini kullanılıyor (YouTube'un
// çerezsiz/az izlenimli embed varyantı).
export function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [/youtu\.be\/([a-zA-Z0-9_-]{11})/, /youtube(?:-nocookie)?\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  // Kullanıcı doğrudan 11 karakterlik video ID'sini yapıştırmış olabilir.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}
