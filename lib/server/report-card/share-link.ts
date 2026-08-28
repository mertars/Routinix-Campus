import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";

const DEFAULT_EXPIRY_DAYS = 7;

// Karneyi oturum açmadan görüntüleyebilen (WhatsApp/SMS ile paylaşılabilir)
// süreli bir bağlantı üretir — çağıran taraf ZATEN karneyi görüntüleme
// yetkisi olduğu doğrulanmış biri olmalı (bkz. app/api/report-cards/[studentId]/share
// route.ts'teki aynı sahiplik kontrolü, GET /api/report-cards/[studentId] ile birebir).
export async function createReportCardShareLink(input: {
  studentId: string;
  periodLabel: string;
  expiresInDays?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? DEFAULT_EXPIRY_DAYS));

  await prisma.reportCardShareLink.create({
    data: { token, studentId: input.studentId, periodLabel: input.periodLabel, expiresAt },
  });

  return { token, expiresAt };
}

export type ShareLinkResolution =
  | { ok: true; studentId: string; periodLabel: string }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" };

// GET /api/report-cards/shared/[token] tarafından kullanılır — BİLEREK
// requireSession() İÇERMEZ, tek kimlik doğrulaması token'ın kendisidir.
export async function resolveReportCardShareLink(token: string): Promise<ShareLinkResolution> {
  const link = await prisma.reportCardShareLink.findUnique({ where: { token } });
  if (!link) return { ok: false, reason: "NOT_FOUND" };
  if (link.expiresAt < new Date()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, studentId: link.studentId, periodLabel: link.periodLabel };
}
