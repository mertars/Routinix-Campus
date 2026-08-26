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
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error("audit_log_write_failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
