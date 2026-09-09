import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/logger";
import type { AuditAction, Prisma } from "@prisma/client";

export type RecordAuditLogInput = {
  institutionId: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

// Kritik yazma işlemlerinin (kullanıcı oluşturma, not girişi, rehberlik
// notu, şifre değişimi) kalıcı izini tutar. BİLEREK "fire and forget":
// audit log yazımı BAŞARISIZ olursa asıl işlemi (öğrenci oluşturma, not
// girme vb.) ASLA engellemez/geri almaz — sadece loglanır. Bir denetim
// kaydının eksik olması, öğretmenin not giremeyip mağdur olmasından daha
// iyi bir risktir.
// Dönen değer: yazılan kaydın id'si, yazılamadıysa null. "Asla
// engellemez" garantisi DEĞİŞMEDİ — id'ye ihtiyacı olmayan çağıranlar
// dönüşü yok sayar; ihtiyacı olan (bkz. toplu işlem geri alma) null
// gelme ihtimalini karşılamak zorundadır.
export async function recordAuditLog(input: RecordAuditLogInput): Promise<string | null> {
  try {
    const created = await prisma.auditLog.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    logger.error("audit_log_write_failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
