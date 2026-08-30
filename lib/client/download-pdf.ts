// Sistemdeki TÜM PDF indirme/açma butonlarının (Gelişim Karnesi, Rehberlik
// A4 Programı, Yıllık Plan, Haftalık Ders Programı, Sınav Giriş Belgesi,
// Toplu Şifre Çıktısı) ORTAK, güvenli indirme yardımcısı.
//
// ⚠️ window.open(url, "_blank") KULLANILMAZ: bir fetch/await'ten SONRA
// çağrılan window.open, tarayıcının "kullanıcı etkileşimi" güven penceresi
// (user activation) zaten kapandığı için POPUP ENGELLEYİCİ tarafından
// SESSİZCE engellenir — kullanıcıya hiçbir hata göstermeden "hiçbir şey
// olmuyormuş" (boş/beyaz ekran) gibi görünür. Bunun yerine rapor kartı
// akışında (bkz. academic-xray.tsx > downloadReportCard, HİÇ engellenmeyen
// tek yer) kullanılan gerçek dosya indirme deseni (gizli <a download> +
// .click()) TEK gerçek kaynak olarak buraya taşındı.
export async function fetchAndDownloadPdf(
  input: RequestInfo,
  init: RequestInit | undefined,
  fileName: string
): Promise<void> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/pdf")) {
    const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
    throw new Error(data?.error ?? "PDF oluşturulamadı.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
