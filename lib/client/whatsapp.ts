// WhatsApp'ın "click to chat" linki (wa.me) SADECE ön-dolu bir METİN
// mesajıyla bir sohbet açabilir — dosya eki API üzerinden EKLENEMEZ (bkz.
// fetchAndSharePdf'teki AYNI kısıt açıklaması, lib/client/download-pdf.ts).
// Bu yüzden "gerçek" bir dosya paylaşımı değil, doğru numaraya ADRESLİ bir
// sohbet açıp PDF'i ayrıca indiren bir akışın parçası (bkz.
// xray-send-to-parent-button.tsx).
export function normalizeTurkishPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeTurkishPhone(phone)}?text=${encodeURIComponent(message)}`;
}
