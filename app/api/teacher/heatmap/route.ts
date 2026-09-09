import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/teacher/heatmap?branchId=&subject= — sınıf başarı ısı haritası.
//
// ⚠️ Bu uç, UYDURMA VERİYİ değiştirmek için yazıldı.
//
// Ekran daha önce lib/mock-data.ts'teki sabit TOPIC_HEATMAP dizisini
// kullanıyordu ve puanı `row.scores[colIndex % row.scores.length]` ile
// seçiyordu — yani puan öğrenciye değil, öğrencinin LİSTEDEKİ SIRASINA
// bağlıydı. Listedeki birinci öğrenci kim olursa olsun Fonksiyonlar'dan
// hep 92 alıyordu. Başlıkta gerçek isimler vardı, ekranda hiçbir uyarı
// yoktu; öğretmen bu tabloya bakıp ödev veriyor, veli arıyordu.
//
// Artık veri TopicMasteryAssessment'tan gelir. Verisi olmayan hücre
// UYDURULMAZ, null döner — arayüz onu "—" olarak gösterir. Boş bir
// hücre, yanlış bir sayıdan iyidir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "ADMIN" && session.role !== "TEACHER") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const branchId = request.nextUrl.searchParams.get("branchId");
    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!branchId || !subject) {
      return NextResponse.json({ error: "branchId ve subject parametreleri zorunludur." }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, institutionId: true },
    });
    if (!branch) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    requireInstitution(session, branch.institutionId);

    if (session.role === "TEACHER") {
      // Ders programı da sahiplik kaynağıdır (bkz. session-guard.ts >
      // assertTeacherOwnsStudent'taki aynı düzeltme).
      const owns = await prisma.branch.findFirst({
        where: {
          id: branchId,
          OR: [
            { advisorId: session.sub },
            { teachingStaff: { some: { id: session.sub } } },
            { lessonSlots: { some: { teacherId: session.sub } } },
          ],
        },
        select: { id: true },
      });
      if (!owns) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const topics = CURRICULUM_TREE[subject] ?? [];
    if (topics.length === 0) {
      // Müfredat ağacında olmayan bir ders için ısı haritası üretilemez;
      // sahte satır göstermek yerine boş dönüp sebebini söylüyoruz.
      return NextResponse.json({
        branchName: branch.name,
        subject,
        students: [],
        rows: [],
        reason: `"${subject}" dersi için tanımlı bir kazanım ağacı yok.`,
      });
    }

    const [students, assessments] = await Promise.all([
      prisma.student.findMany({
        where: { branchId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.topicMasteryAssessment.findMany({
        where: { subject, student: { branchId, isActive: true } },
        select: { studentId: true, subtopicId: true, masteryScore: true },
      }),
    ]);

    // (öğrenci, kazanım) → puan
    const scoreByKey = new Map<string, number>();
    for (const a of assessments) scoreByKey.set(`${a.studentId}|${a.subtopicId}`, a.masteryScore);

    // Yalnızca EN AZ BİR ölçümü olan kazanımlar satır olur. Hiç verisi
    // olmayan kazanımlar için baştan sona boş satır göstermek tabloyu
    // okunmaz hale getirir; öğretmen "hangi konuda neredeyiz"i görmek
    // istiyor, müfredatın tamamını değil.
    const rows: { subtopicId: string; topic: string; subtopic: string; scores: (number | null)[] }[] = [];
    for (const topic of topics) {
      for (const sub of topic.subtopics) {
        const scores = students.map((s) => scoreByKey.get(`${s.id}|${sub.id}`) ?? null);
        if (scores.every((v) => v === null)) continue;
        rows.push({ subtopicId: sub.id, topic: topic.name, subtopic: sub.name, scores });
      }
    }

    return NextResponse.json({
      branchName: branch.name,
      subject,
      students: students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })),
      rows,
      measuredCells: assessments.length,
      reason: rows.length === 0 ? "Bu şube ve ders için henüz kazanım ölçümü yok." : undefined,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("teacher_heatmap_failed", error);
  }
}

export const GET = withApiLogging("GET /api/teacher/heatmap", handleGet);
