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
async function fetchPdfBlob(input: RequestInfo, init: RequestInit | undefined): Promise<Blob> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/pdf")) {
    const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
    throw new Error(data?.error ?? "PDF oluşturulamadı.");
  }
  return res.blob();
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function fetchAndDownloadPdf(input: RequestInfo, init: RequestInit | undefined, fileName: string): Promise<void> {
  const blob = await fetchPdfBlob(input, init);
  downloadBlob(blob, fileName);
}

// Faz T — "WhatsApp'a PDF'i yüklü halde göndermek" isteği: WhatsApp'ın
// kendisi bunu SAĞLAMIYOR (wa.me linki SADECE metin ön-doldurur, dosya
// ekleyemez — platform kısıtı). Tarayıcının NATIVE paylaşım sayfasını
// (Web Share API) açmak GERÇEK yol — bu, kullanıcının "bir dosyayı seçip
// Paylaş'a basınca WhatsApp'ın açılması" ile gördüğü AYNI sistem
// penceresidir (macOS/iOS paylaşım eklentisi olarak kayıtlı uygulamalar
// arasında WhatsApp da çıkar). SADECE dosya paylaşımını destekleyen
// tarayıcılarda çalışır (mobil Safari/Chrome, masaüstü Safari) —
// desteklenmiyorsa (masaüstü Chrome/Firefox, bkz. canShare kontrolü)
// SESSİZCE normal indirmeye döner, hiçbir tarayıcıda kırılmaz.
export async function fetchAndSharePdf(
  input: RequestInfo,
  init: RequestInit | undefined,
  fileName: string,
  shareTitle?: string
): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await fetchPdfBlob(input, init);
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareTitle ?? fileName });
      return "shared";
    } catch (error) {
      // Kullanıcı paylaşım sayfasını İPTAL ETTİYSE (AbortError) bu bir
      // HATA değil, bilinçli bir vazgeçme — indirmeye DÜŞMEDEN sessizce çık.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Başka bir sebeple paylaşım başarısız olduysa normal indirmeye düş.
    }
  }

  downloadBlob(blob, fileName);
  return "downloaded";
}
