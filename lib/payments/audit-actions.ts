// Ödeme modülünün denetim izi sabitleri.
//
// SUNUCU BAĞIMLILIĞI YOK (prisma vb. import etmez) — hem server route'ları
// hem client bileşenleri buradan okur. lib/server/payments/payment-audit.ts
// içinde dursaydı, etiketleri kullanan bir client bileşeni Prisma'yı
// istemci paketine sürüklerdi.

export type PaymentAuditAction =
  | "PAYMENT_COLLECTED"
  | "PAYMENT_VOIDED"
  | "INSTALLMENT_PLAN_CREATED"
  | "INSTALLMENT_POSTPONED"
  | "INSTALLMENT_RESTRUCTURED"
  | "ENROLLMENT_CANCELLED"
  | "DISCOUNT_GRANTED"
  | "EXPENSE_PAID"
  | "ACCOUNT_TRANSFERRED"
  | "PAYROLL_PAID"
  | "CASH_COUNTED"
  | "PAYMENT_ROLE_CHANGED";

export const PAYMENT_AUDIT_LABEL: Record<PaymentAuditAction, string> = {
  PAYMENT_COLLECTED: "Tahsilat alındı",
  PAYMENT_VOIDED: "Tahsilat iptal edildi",
  INSTALLMENT_PLAN_CREATED: "Taksit planı oluşturuldu",
  INSTALLMENT_POSTPONED: "Taksit ertelendi",
  INSTALLMENT_RESTRUCTURED: "Plan yapılandırıldı",
  ENROLLMENT_CANCELLED: "Kayıt iptal edildi",
  DISCOUNT_GRANTED: "İndirim tanımlandı",
  EXPENSE_PAID: "Gider ödendi",
  ACCOUNT_TRANSFERRED: "Hesaplar arası virman",
  PAYROLL_PAID: "Bordro ödendi",
  CASH_COUNTED: "Gün sonu kasa sayımı",
  PAYMENT_ROLE_CHANGED: "Ödeme yetkisi değiştirildi",
};

// Eylemin kurumun kasasına net etkisi.
//
// İkili (giriş/çıkış) bir ayrım YETMEZ: virman iki hesap arasında para
// taşır, kurumun toplam nakdi DEĞİŞMEZ; taksit ertelemesi/yapılandırma
// ise hiç para hareketi değildir, yalnızca borcun takvimini değiştirir.
// Bunları yeşil "+" ile göstermek, olmayan bir tahsilat izlenimi verirdi.
export type AuditFlow = "IN" | "OUT" | "NEUTRAL";

export const ACTION_FLOW: Record<PaymentAuditAction, AuditFlow> = {
  PAYMENT_COLLECTED: "IN",
  PAYMENT_VOIDED: "OUT",
  ENROLLMENT_CANCELLED: "OUT",
  EXPENSE_PAID: "OUT",
  PAYROLL_PAID: "OUT",
  ACCOUNT_TRANSFERRED: "NEUTRAL",
  INSTALLMENT_PLAN_CREATED: "NEUTRAL",
  INSTALLMENT_POSTPONED: "NEUTRAL",
  INSTALLMENT_RESTRUCTURED: "NEUTRAL",
  DISCOUNT_GRANTED: "NEUTRAL",
  CASH_COUNTED: "NEUTRAL",
  PAYMENT_ROLE_CHANGED: "NEUTRAL",
};
