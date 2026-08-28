import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Platform sahibinin hesap başına ücretlendirmesi için TEK gerçek kaynak:
// bir kurumun ŞU AN kaç öğrenci/öğretmen hesabı olduğunu (ve her birinin NE
// ZAMAN açıldığını) canlı sorgular — bu hesaplar dershane yöneticisi
// tarafından tekli "Yeni Kullanıcı Ekle" veya Excel toplu içe aktarmayla
// oluşturulmuş olsun fark etmez, ikisi de AYNI Student/Teacher tablosuna
// yazar, bu yüzden burada ayrıca "nasıl oluşturuldu" ayrımı yapmaya gerek
// yok. institutionId'ye göre filtrelenir — platform oturumu hiçbir öğrenci/
// öğretmenin diğer alanlarına (net, yoklama, veli bilgisi vb.) erişemez,
// sadece faturalama için gereken minimum alan seti döner.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePlatformSession();

    const institution = await prisma.institution.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
    if (!institution) return NextResponse.json({ error: "Kurum bulunamadı." }, { status: 404 });

    // ⚠️ isActive: true — pasifleştirilmiş (bkz. Student/Teacher.isActive)
    // hesaplar burada SAYILMAZ. Bu uç ücretlendirmenin gerçek kaynağı
    // olduğundan, yönetici bir öğrenci/öğretmenin üyeliğini sonlandırdığında
    // o kişi bir sonraki faturalama görünümünde artık sayılmamalı.
    const [students, teachers] = await Promise.all([
      prisma.student.findMany({
        where: { institutionId: params.id, isActive: true },
        select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true, branch: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.teacher.findMany({
        where: { institutionId: params.id, isActive: true },
        select: { id: true, firstName: true, lastName: true, mobilePhone: true, subject: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      institution,
      students: students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        phone: s.phone,
        branchName: s.branch.name,
        createdAt: s.createdAt,
      })),
      teachers: teachers.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        phone: t.mobilePhone,
        subject: t.subject,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("platform_institution_detail_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/institutions/[id]", handleGet);
