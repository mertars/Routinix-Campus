import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { AVERAGE_WEEKS_PER_MONTH } from "@/lib/server/payroll/payroll-service";

export const dynamic = "force-dynamic";

// GET — kurumun TÜM personeli (öğretmen + yönetici), varsa ücret profiliyle.
// Profili olmayanlar da listelenir ki yönetici tek ekrandan tanımlayabilsin.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");
    const institutionId = session.institutionId;

    const [teachers, admins, profiles, slotCounts] = await Promise.all([
      prisma.teacher.findMany({
        where: { institutionId, isActive: true },
        select: { id: true, firstName: true, lastName: true, subject: true },
        orderBy: [{ firstName: "asc" }],
      }),
      prisma.admin.findMany({
        where: { institutionId },
        select: { id: true, firstName: true, lastName: true, title: true },
        orderBy: [{ firstName: "asc" }],
      }),
      prisma.staffSalaryProfile.findMany({ where: { institutionId } }),
      prisma.lessonSlot.groupBy({ by: ["teacherId"], where: { branch: { institutionId } }, _count: { _all: true } }),
    ]);

    const profileByTeacher = new Map(profiles.filter((p) => p.teacherId).map((p) => [p.teacherId!, p]));
    const profileByAdmin = new Map(profiles.filter((p) => p.adminId).map((p) => [p.adminId!, p]));
    const weeklyByTeacher = new Map(slotCounts.map((r) => [r.teacherId, r._count._all]));

    const staff = [
      ...teachers.map((t) => {
        const p = profileByTeacher.get(t.id);
        const weekly = weeklyByTeacher.get(t.id) ?? 0;
        return {
          key: `teacher:${t.id}`,
          teacherId: t.id,
          adminId: null as string | null,
          name: `${t.firstName} ${t.lastName}`,
          role: "Öğretmen",
          subtitle: t.subject,
          weeklyHours: weekly,
          monthlyHours: Math.round(weekly * AVERAGE_WEEKS_PER_MONTH * 100) / 100,
          payType: p?.payType ?? null,
          monthlyAmount: p?.monthlyAmount ? Number(p.monthlyAmount) : null,
          hourlyRate: p?.hourlyRate ? Number(p.hourlyRate) : null,
        };
      }),
      ...admins.map((a) => {
        const p = profileByAdmin.get(a.id);
        return {
          key: `admin:${a.id}`,
          teacherId: null as string | null,
          adminId: a.id,
          name: `${a.firstName} ${a.lastName}`,
          role: "Yönetici",
          subtitle: a.title,
          weeklyHours: 0,
          monthlyHours: 0,
          payType: p?.payType ?? null,
          monthlyAmount: p?.monthlyAmount ? Number(p.monthlyAmount) : null,
          hourlyRate: p?.hourlyRate ? Number(p.hourlyRate) : null,
        };
      }),
    ];

    return NextResponse.json({ staff });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("salary_profiles_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { teacherId? | adminId?, payType, monthlyAmount?, hourlyRate? }
// Aynı personel için profil varsa GÜNCELLENİR (upsert).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const teacherId = (body?.teacherId as string | undefined) || null;
    const adminId = (body?.adminId as string | undefined) || null;
    const payType = body?.payType as "MONTHLY_SALARY" | "HOURLY" | undefined;
    const monthlyAmount = body?.monthlyAmount != null ? Number(body.monthlyAmount) : null;
    const hourlyRate = body?.hourlyRate != null ? Number(body.hourlyRate) : null;

    if (!teacherId && !adminId) return NextResponse.json({ error: "teacherId veya adminId zorunludur." }, { status: 400 });
    if (teacherId && adminId) return NextResponse.json({ error: "Aynı anda hem teacherId hem adminId verilemez." }, { status: 400 });
    if (payType !== "MONTHLY_SALARY" && payType !== "HOURLY") return NextResponse.json({ error: "payType geçersiz." }, { status: 400 });
    if (payType === "MONTHLY_SALARY" && (!Number.isFinite(monthlyAmount) || (monthlyAmount ?? 0) <= 0)) {
      return NextResponse.json({ error: "Aylık ücret pozitif bir sayı olmalı." }, { status: 400 });
    }
    if (payType === "HOURLY" && (!Number.isFinite(hourlyRate) || (hourlyRate ?? 0) <= 0)) {
      return NextResponse.json({ error: "Saat ücreti pozitif bir sayı olmalı." }, { status: 400 });
    }
    // Yönetici ders programında yer almaz — saatlik ücret hesaplanamaz.
    if (adminId && payType === "HOURLY") {
      return NextResponse.json({ error: "Yönetici için saatlik ücret desteklenmiyor." }, { status: 400 });
    }

    // Tenant doğrulaması — başka kurumun personeline profil açılamaz.
    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!t || t.institutionId !== session.institutionId) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    } else if (adminId) {
      const a = await prisma.admin.findUnique({ where: { id: adminId }, select: { institutionId: true } });
      if (!a || a.institutionId !== session.institutionId) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    }

    const data = {
      institutionId: session.institutionId,
      payType,
      monthlyAmount: payType === "MONTHLY_SALARY" ? monthlyAmount : null,
      hourlyRate: payType === "HOURLY" ? hourlyRate : null,
      isActive: true,
    };

    const profile = teacherId
      ? await prisma.staffSalaryProfile.upsert({ where: { teacherId }, create: { ...data, teacherId }, update: data })
      : await prisma.staffSalaryProfile.upsert({ where: { adminId: adminId! }, create: { ...data, adminId }, update: data });

    return NextResponse.json({ profile: { id: profile.id, payType: profile.payType } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("salary_profile_save_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/salary-profiles", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/salary-profiles", handlePost);
