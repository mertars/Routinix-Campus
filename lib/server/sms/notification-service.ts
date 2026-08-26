import { prisma } from "@/lib/server/prisma";
import { resolveScope } from "./scope-resolver";
import { renderTemplate } from "./template-parser";
import { createSmsProvider } from "./provider-factory";
import { InProcessQueue } from "@/lib/server/queue/in-process-queue";
import type { NotificationScopeType } from "@prisma/client";

export type SendBulkInput = {
  institutionId: string;
  scopeType: NotificationScopeType;
  scopeValue?: string;
  templateBody: string;
  extraParams?: Record<string, string>;
};

type SmsJob = { logId: string; phone: string; message: string };

// Sağlayıcı ve kuyruk, modül yüklenirken bir kere kurulur (Next.js dev'de
// sıcak yeniden yükleme sırasında birden fazla kurulmaması için globalThis
// üzerinden singleton yapılır).
const globalForSms = globalThis as unknown as { smsQueue?: InProcessQueue<SmsJob> };

function getSmsQueue(): InProcessQueue<SmsJob> {
  if (globalForSms.smsQueue) return globalForSms.smsQueue;

  const provider = createSmsProvider();
  const queue = new InProcessQueue<SmsJob>();

  queue.process(async ({ logId, phone, message }) => {
    const result = await provider.send(phone, message);
    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status: result.success ? "SENT" : "FAILED",
        providerName: provider.name,
        providerRef: result.providerRef,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : undefined,
      },
    });
  });

  globalForSms.smsQueue = queue;
  return queue;
}

export async function sendBulkNotification(input: SendBulkInput) {
  const recipients = await resolveScope(input.scopeType, input.scopeValue, input.institutionId);
  if (recipients.length === 0) {
    throw new Error("Bu kapsamda SMS onayı (smsConsent) olan alıcı bulunamadı.");
  }

  const batch = await prisma.notificationBatch.create({
    data: { institutionId: input.institutionId, scopeType: input.scopeType, scopeValue: input.scopeValue, rawMessage: input.templateBody },
  });

  const queue = getSmsQueue();

  for (const recipient of recipients) {
    const message = renderTemplate(input.templateBody, {
      veli_adi: recipient.parentName,
      ogrenci_adi: recipient.studentName,
      ...input.extraParams,
    });

    const log = await prisma.notificationLog.create({
      data: {
        batchId: batch.id,
        recipientPhone: recipient.phone,
        recipientName: recipient.parentName,
        message,
        status: "PENDING",
      },
    });

    await queue.enqueue({ logId: log.id, phone: recipient.phone, message });
  }

  return { batchId: batch.id, recipientCount: recipients.length };
}

export async function getBatchStatus(batchId: string, institutionId: string) {
  const batch = await prisma.notificationBatch.findUnique({ where: { id: batchId }, select: { institutionId: true } });
  if (!batch || batch.institutionId !== institutionId) throw new Error("Bildirim grubu (batch) bulunamadı.");

  const logs = await prisma.notificationLog.findMany({ where: { batchId } });

  return {
    batchId,
    total: logs.length,
    pending: logs.filter((log) => log.status === "PENDING").length,
    sent: logs.filter((log) => log.status === "SENT").length,
    failed: logs.filter((log) => log.status === "FAILED").length,
  };
}
