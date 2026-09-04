// Video Ders Merkezi — kullanıcı kararı (2026-09-03): videolar YouTube'da
// (gizli/liste dışı) barındırılıyor, biz SADECE embed ediyoruz — depolama/
// bant genişliği maliyeti yok, oynatma kalitesi YouTube'un kendi adaptif
// altyapısından geliyor (R2 + tarayıcı-içi dönüştürme denendi ama yavaş/
// tutarsız çıktı). Oynatıcının kendisi components/video-portal/
// youtube-player.tsx'te IFrame Player API ile kuruluyor, burada sadece
// küçük resim URL'si türetiliyor.
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
