import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  requireSession,
  requireRole,
  requireInstitution,
  assertOwnsSelf,
  assertTeacherOwnsStudent,
  assertParentOwnsStudent,
} from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/guidance-program?studentId=X — rehberlik biriminin öğrenciye
// gönderdiği kişisel çalışma programlarının geçmişi. Yönetici panelindeki
// geçmiş görünümü VE öğrencinin kendi portalındaki "Rehberlik" sekmesi
// (bkz. components/student/tabs/guidance.tsx) AYNI ucu kullanır — bu
// yüzden sahiplik kontrolü exam-seating'teki (GET /api/exam-seating) ile
// birebir aynı desene sahip: principal her öğrenciyi görür, öğrenci/
// öğretmen/veli sadece kendi ilişkili öğrencisini görebilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId);
    // ⚠️ Rehberlik eklendi: bu ekran zaten YÖNETİCİ panelinde vardı ve
    // rehber öğretmen kendi asli aracına (çalışma programı) erişemiyordu
    // (Mert, 2026-09-15: "plan program oluşturamıyor").
    else requireRole(session, "principal", "guidance");

    const programs = await prisma.guidanceProgram.findMany({
      where: { studentId },
      // Video bloklarında öğrencinin videoyu AÇABİLMESİ için başlık ve
      // youtubeId gerekir — aksi halde "bir video izle" yazan ama nereye
      // gideceğini söylemeyen bir satır kalırdı.
      include: { entries: { include: { video: { select: { id: true, title: true, youtubeId: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ programs });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_list_failed", error);
  }
}

// POST /api/guidance-program — { studentId, weekLabel, entries: [{day,time,subject,topic,questionTarget}] }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "guidance");

    const body = await request.json();
    const { studentId, weekLabel, entries } = body as {
      studentId?: string;
      weekLabel?: string;
      entries?: {
        day: string;
        time: string;
        subject: string;
        topic: string;
        questionTarget: number;
        // Blok türü ve ekleri (bkz. schema.prisma > GuidanceProgramEntry).
        // Gönderilmezse QUESTION varsayılır — eski istemciler kırılmaz.
        kind?: "QUESTION" | "TOPIC_STUDY" | "VIDEO" | "XRAY_TEST";
        videoId?: string | null;
        subtopicId?: string | null;
        note?: string | null;
      }[];
    };
    if (!studentId || !weekLabel?.trim() || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "studentId, weekLabel ve en az bir entry zorunludur." }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    // ⚠️ VIDEO bloklarındaki videoId KURUM İÇİNDEN doğrulanır — istemciden
    // gelen id'ye güvenilmez (CLAUDE.md). Aksi halde başka bir kurumun
    // videosu bir öğrencinin programına iliştirilebilirdi.
    const videoIds = [...new Set(entries.map((e) => e.videoId).filter((v): v is string => !!v))];
    if (videoIds.length > 0) {
      const ok = await prisma.video.count({ where: { id: { in: videoIds }, institutionId: student.institutionId } });
      if (ok !== videoIds.length) {
        return NextResponse.json({ error: "Seçilen videolardan biri bu kuruma ait değil." }, { status: 400 });
      }
    }

    const program = await prisma.guidanceProgram.create({
      data: {
        studentId,
        weekLabel: weekLabel.trim(),
        entries: {
          create: entries.map((e) => ({
            day: e.day,
            time: e.time,
            subject: e.subject,
            topic: e.topic,
            questionTarget: e.questionTarget,
            kind: e.kind ?? "QUESTION",
            videoId: e.kind === "VIDEO" ? (e.videoId ?? null) : null,
            subtopicId: e.subtopicId ?? null,
            note: e.note?.trim() || null,
          })),
        },
      },
      include: { entries: true },
    });

    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance-program", handleGet);
export const POST = withApiLogging("POST /api/guidance-program", handlePost);
