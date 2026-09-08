// Ödeme modülü yetki seviyeleri — SUNUCU BAĞIMLILIĞI YOK, client
// bileşenleri de buradan okur (bkz. audit-actions.ts'teki aynı gerekçe).

export type PaymentRole = "NONE" | "COLLECTOR" | "FULL";

export const PAYMENT_ROLE_LABEL: Record<PaymentRole, string> = {
  NONE: "Erişim yok",
  COLLECTOR: "Tahsildar",
  FULL: "Tam yetki",
};

export const PAYMENT_ROLE_DESCRIPTION: Record<PaymentRole, string> = {
  NONE: "Ödeme modülünü hiç açamaz.",
  COLLECTOR: "Tahsilat alır, borç ve taksit planlarını görür. Para çıkaran hiçbir işlemi yapamaz.",
  FULL: "Gider, bordro, virman, iptal ve iade dahil her işlemi yapabilir.",
};

// COLLECTOR'ın ERİŞEBİLDİĞİ sekmeler. Liste "neyi yapamaz" değil "neyi
// yapabilir" üzerinden kurulur: yeni bir sekme eklendiğinde varsayılan
// olarak KAPALI olur, yanlışlıkla açık kalmaz.
export const COLLECTOR_TABS = ["dashboard", "students"] as const;

export function canAccessTab(role: PaymentRole, tabId: string): boolean {
  if (role === "NONE") return false;
  if (role === "FULL") return true;
  return (COLLECTOR_TABS as readonly string[]).includes(tabId);
}
