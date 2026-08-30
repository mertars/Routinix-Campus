import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { SCREENING_GRADES } from "@/lib/server/xray/monthly-screening";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/monthly-screening-config — kurumun HER sınıf seviyesi
// (9-12) için aylık tarama testi ayarını döner — henüz hiç kaydedilmemiş
// bir seviye için "enabled:false" bir taslak satır üretilir (böylece UI
// her zaman 4 satır gösterebilir, konfigüre edilmemiş olsa bile).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const rows = await prisma.xrayMonthlyScreeningConfig.findMany({ where: { institutionId: session.institutionId } });
    const byGrade = new Map(rows.map((r) => [r.grade, r]));

    const configs = SCREENING_GRADES.map((grade) => {
      const row = byGrade.get(grade);
      if (!row) return { grade, enabled: false, subject: null, subtopicId: null, subtopicName: null, intervalDays: 30, nextRunAt: null };
      const topics = CURRICULUM_TREE[row.subject] ?? [];
      const subtopicName = topics.flatMap((t) => t.subtopics).find((s) => s.id === row.subtopicId)?.name ?? row.subtopicId;
      return {
        grade,
        enabled: row.enabled,
        subject: row.subject,
        subtopicId: row.subtopicId,
        subtopicName,
        intervalDays: row.intervalDays,
        nextRunAt: row.nextRunAt.toISOString(),
      };
    });

    return NextResponse.json({ configs });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_monthly_screening_config_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/xray/monthly-screening-config — { grade, enabled, subject,
// subtopicId, intervalDays } — HER kayıtta (enabled=true iken) nextRunAt
// = şimdi + intervalDays olarak SIFIRLANIR — "kaç gün sonra atılacak"
// göstergesinin her zaman son kaydedilen ayarla tutarlı, tahmin edilebilir
// olması için (bkz. şema yorumundaki tasarım kararı — kısmi/koşullu
// koruma mantığı BİLEREK tercih edilmedi, sürpriz zamanlamalara yol açardı).
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { grade, enabled, subject, subtopicId, intervalDays } = body as {
      grade?: number;
      enabled?: boolean;
      subject?: string;
      subtopicId?: string;
      intervalDays?: number;
    };
    if (!grade || !SCREENING_GRADES.includes(grade as (typeof SCREENING_GRADES)[number])) {
      return NextResponse.json({ error: "Geçersiz sınıf seviyesi." }, { status: 400 });
    }
    if (enabled && (!subject?.trim() || !subtopicId?.trim())) {
      return NextResponse.json({ error: "Tarama aktifken subject ve subtopicId zorunludur." }, { status: 400 });
    }
    const days = Math.max(1, Math.min(365, Math.round(intervalDays ?? 30)));

    if (enabled) {
      const pool = await prisma.xrayPracticeQuestion.count({ where: { subject: subject!.trim(), subtopicId: subtopicId!.trim() } });
      if (pool === 0) return NextResponse.json({ error: "Bu konu için soru havuzunda içerik yok." }, { status: 400 });
    }

    const nextRunAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const config = await prisma.xrayMonthlyScreeningConfig.upsert({
      where: { institutionId_grade: { institutionId: session.institutionId, grade } },
      create: {
        institutionId: session.institutionId,
        grade,
        enabled: !!enabled,
        subject: subject?.trim() ?? "",
        subtopicId: subtopicId?.trim() ?? "",
        intervalDays: days,
        nextRunAt,
        configuredById: session.sub,
      },
      update: {
        enabled: !!enabled,
        subject: subject?.trim() ?? "",
        subtopicId: subtopicId?.trim() ?? "",
        intervalDays: days,
        nextRunAt,
        configuredById: session.sub,
      },
    });

    return NextResponse.json({ grade: config.grade, enabled: config.enabled, nextRunAt: config.nextRunAt.toISOString() });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_monthly_screening_config_save_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/monthly-screening-config", handleGet);
export const PUT = withApiLogging("PUT /api/xray/monthly-screening-config", handlePut);
