import { recordAuditLog } from "@/lib/server/audit/audit-log";
import type { PaymentAuditAction } from "@/lib/payments/audit-actions";

// Etiketler ve "kasadan çıkış" listesi client bileşenlerinden de okunduğu
// için lib/payments/audit-actions.ts içinde durur (bu dosya prisma'ya
// bağlıdır, oraya import edilemez).
export type { PaymentAuditAction };

type PaymentAuditInput = {
  session: { sub: string; role: string; institutionId: string };
  action: PaymentAuditAction;
  targetType: string;
  targetId: string;
  /** Olayın tutarı. Tutarsız bir finansal iz kaydı işe yaramaz. */
  amount: number;
  /**
   * İnsan-okur tek satır özet ("Ahmet Yılmaz · Taksit 3/12").
   *
   * YAZMA ANINDA sabitlenir, okuma anında join'le türetilmez: kaydın
   * kendisi sonradan silinse/değişse bile iz doğru okunmalıdır (aynı
   * gerekçe StudentContract.content'te de var).
   */
  summary: string;
  metadata?: Record<string, unknown>;
};

// recordAuditLog gibi "fire and forget": iz yazımı başarısız olsa bile
// asıl finansal işlem GERİ ALINMAZ — tahsilatın kaydedilememesi, izin
// eksik kalmasından çok daha kötüdür.
export async function recordPaymentAudit(input: PaymentAuditInput): Promise<void> {
  await recordAuditLog({
    institutionId: input.session.institutionId,
    actorId: input.session.sub,
    actorRole: input.session.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: { ...input.metadata, amount: input.amount, summary: input.summary },
  });
}
