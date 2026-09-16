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
      // ⚠️ Blok TAMAMLANMA durumu buradan gelir: video için VideoAssignment
      // (watchedAt/lastPositionSeconds), röntgen için atamanın kendi status'ü.
      // Hem öğrenci "ne kaldı" görür hem rehberlik "izledi mi" görür — tek
      // gerçek, iki taraf.
      include: {
        entries: {
          include: {
            video: { select: { id: true, title: true, youtubeId: true, durationSeconds: true } },
            xrayAssignment: { select: { id: true, status: true, completedAt: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Video izleme durumu — VideoAssignment öğrenci+video bazlı (bkz.
    // @@unique). Program satırında videoId var, izleme orada; tek sorguda
    // topla ve blokla eşle (blok başına sorgu N tur demekti).
    const videoIds = [...new Set(programs.flatMap((p) => p.entries.map((e) => e.videoId).filter((v): v is string => !!v)))];
    const watchRows = videoIds.length
      ? await prisma.videoAssignment.findMany({
          where: { studentId, videoId: { in: videoIds } },
          select: { id: true, videoId: true, watchedAt: true, lastPositionSeconds: true, watchedSeconds: true },
        })
      : [];
    const watchByVideo = new Map(watchRows.map((w) => [w.videoId, w]));
    return NextResponse.json({
      programs: programs.map((p) => ({
        ...p,
        entries: p.entries.map((e) => {
          const w = e.videoId ? watchByVideo.get(e.videoId) : null;
          return {
            ...e,
            // Öğrencinin bu bloğu açabilmesi için gereken atama kimliği
            // (video oynatıcı ilerlemeyi bununla kaydeder).
            videoAssignmentId: w?.id ?? null,
            watchedAt: w?.watchedAt?.toISOString() ?? null,
            lastPositionSeconds: w?.lastPositionSeconds ?? null,
            // ⚠️ "Ne kadar izledi" — en ileri gidilen nokta ve yüzdesi
            // (bkz. schema.prisma > VideoAssignment.watchedSeconds).
            watchedSeconds: w?.watchedSeconds ?? null,
            videoDurationSeconds: e.video?.durationSeconds ?? null,
            watchedPercent:
              w?.watchedSeconds && e.video?.durationSeconds
                ? Math.min(100, Math.round((w.watchedSeconds / e.video.durationSeconds) * 100))
                : null,
            // Blok "yapıldı" mı? Video izlendiyse, röntgen testi
            // tamamlandıysa. Soru/konu bloklarında böyle bir sinyal yok —
            // null döner, arayüz onları tamamlanma göstermez.
            // ⚠️ Her blok için ARTIK bir tamamlanma sinyali var. Video ve
            // röntgende doğal sinyal (izlendi/çözüldü) önceliklidir; soru ve
            // konu çalışmada öğrencinin elle işaretlemesi (completedAt)
            // kullanılır. Böylece rehberlik dört türün TAMAMINDA ilerleme
            // görür — eskiden soru bloğu hep "takip edilemez"di.
            // ⚠️ VIDEO'da "bitti" ölçütü watchedAt DEĞİL: o damga ilk
            // oynatma anında konuyor (bkz. videos.tsx > onFirstPlay), yani
            // 1 saniye izleyen öğrencinin bloğu yeşile dönerdi. Ölçüt
            // videonun %90'ını görmüş olmak; süre bilinmiyorsa eski
            // davranışa (watchedAt) düşülür.
            done:
              e.kind === "VIDEO"
                ? (w?.watchedSeconds && e.video?.durationSeconds
                    ? w.watchedSeconds / e.video.durationSeconds >= 0.9
                    : !!w?.watchedAt) || !!e.completedAt
                : e.kind === "XRAY_TEST" && e.xrayAssignment
                  ? e.xrayAssignment.status === "COMPLETED" || !!e.completedAt
                  : !!e.completedAt,
            // Elle işaretlenebilir mi? Video izlendiyse/test çözüldüyse
            // öğrencinin ayrıca işaretlemesine gerek yok.
            manualDone: !!e.completedAt,
          };
        }),
      })),
    });
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

    // ⚠️ BLOKLAR GERÇEK ATAMA OLUŞTURUR (Mert, 2026-09-15: "video izlenmiyor,
    // röntgen testi atamada gelsin... yapınca rehberlik öğrenciye tıkladığında
    // izlediğini görebilsin").
    //
    // Paralel bir takip mekanizması KURULMADI: program bloğu sistemin ZATEN
    // olan atama kayıtlarını üretir (VideoAssignment, XrayComprehensionAssignment).
    // Böylece öğrenci videoyu kendi video panelinden açar, izleme yüzdesi ve
    // watchedAt eskiden beri çalışan mekanizmayla dolar, rehberlik de aynı
    // kayıttan "izledi mi" sorusunun cevabını alır. Ayrı bir alan tutulsaydı
    // iki gerçek (öğrencinin gördüğü ve rehberin gördüğü) ayrışırdı.
    const videoBlocks = entries.filter((e) => e.kind === "VIDEO" && e.videoId);
    const xrayBlocks = entries.filter((e) => e.kind === "XRAY_TEST" && e.subtopicId);

    // Video ataması: @@unique([videoId, studentId]) var — aynı video ikinci
    // kez programa konursa YENİ atama açılmaz, mevcut olan korunur
    // (izleme ilerlemesi sıfırlanmasın).
    for (const b of videoBlocks) {
      await prisma.videoAssignment.upsert({
        where: { videoId_studentId: { videoId: b.videoId!, studentId } },
        update: {},
        create: { videoId: b.videoId!, studentId },
      });
    }

    // Röntgen ataması: aynı konudan TEKRAR test alınabilir (şemada @@unique
    // yok, bkz. comprehension-assignments route'undaki not) — her blok için
    // yeni bir atama açılır. Soru havuzunda içerik yoksa atama YAPILMAZ ama
    // blok yine de plana yazılır (öğrenciye "bu konuya çalış" demek yine
    // anlamlı; açılmayan bir test linki vermek değil).
    const xrayAssignmentByKey = new Map<string, string>();
    for (const b of xrayBlocks) {
      const hasQuestions = await prisma.xrayComprehensionQuestion.count({
        where: { subject: b.subject.trim(), subtopicId: b.subtopicId!.trim() },
      });
      if (hasQuestions === 0) continue;
      const created = await prisma.xrayComprehensionAssignment.create({
        data: {
          studentId,
          subject: b.subject.trim(),
          subtopicId: b.subtopicId!.trim(),
          // Rehberlik bir Teacher kaydıdır — atamayı ona bağla.
          ...(session.role === "GUIDANCE" ? { assignedByTeacherId: session.sub } : { assignedById: session.sub }),
        },
        select: { id: true },
      });
      xrayAssignmentByKey.set(`${b.day}|${b.time}|${b.subtopicId}`, created.id);
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
            xrayAssignmentId:
              e.kind === "XRAY_TEST" ? (xrayAssignmentByKey.get(`${e.day}|${e.time}|${e.subtopicId}`) ?? null) : null,
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
