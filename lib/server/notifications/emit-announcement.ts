import { prisma } from "@/lib/server/prisma";
import { notify, guidanceStaff, type NotifyRecipient } from "@/lib/server/notifications/activity";

// Duyuru bildirimlerinin TEK yeri.
//
// Duyurunun kendi hedefleme mantığı var (scopeType: ALL_SCHOOL / GRADE /
// BRANCH / ...). Bildirimin de AYNI kitleye gitmesi gerekiyor — bu yüzden
// hedef çözümü burada bir kez yazılıp rotadan çağrılıyor.
//
// ⚠️ Duyuru KUTUYU DOLDURMAK İÇİN DEĞİL: ilan panosu (Duyurular sekmesi)
// duruyor, buradaki bildirim yalnızca "yeni duyuru var" haberidir.
export async function emitAnnouncementNotifications(announcement: {
  id: string;
  institutionId: string;
  title: string;
  content: string;
  scopeType: string;
  scopeValue: string | null;
  authorName: string;
}): Promise<void> {
  try {
    const { institutionId, scopeType, scopeValue } = announcement;

    // Hedef öğrenciler — duyurunun kapsamına göre.
    const studentWhere =
      scopeType === "BRANCH" && scopeValue
        ? { institutionId, isActive: true, branch: { name: scopeValue } }
        : scopeType === "GRADE" && scopeValue
          ? { institutionId, isActive: true, branch: { grade: Number(scopeValue) || undefined } }
          : { institutionId, isActive: true };

    const students = await prisma.student.findMany({ where: studentWhere, select: { id: true } });
    const studentIds = students.map((s) => s.id);

    // ⚠️ Rehberlik personeli de kurum çalışanıdır — okul geneli duyuru
    // ona da ulaşmalı. Denetimde bulundu: alıcı listesi öğrenci+veli+
    // öğretmenden kuruluyordu, rehberliğin kutusuna HİÇBİR duyuru düşmüyordu.
    const [parentLinks, teachers] = await Promise.all([
      prisma.parentStudent.findMany({ where: { studentId: { in: studentIds } }, select: { parentId: true } }),
      // Öğretmenler yalnızca okul geneli duyurularda — şube/kademe
      // duyurusu öğrenciye yöneliktir, tüm öğretmenleri rahatsız etmez.
      scopeType === "ALL_SCHOOL"
        ? prisma.teacher.findMany({ where: { institutionId, isActive: true }, select: { id: true } })
        : Promise.resolve([] as { id: string }[]),
    ]);

    // Rehberlik kimliği de bir Teacher kaydıdır (subject="Rehberlik");
    // onlara TEACHER değil GUIDANCE rolüyle yazılır, yoksa kendi
    // panelindeki kutuda görünmez.
    const guidance = scopeType === "ALL_SCHOOL" ? await guidanceStaff(institutionId) : [];
    const guidanceIds = new Set(guidance.map((g) => g.id));

    const recipients: NotifyRecipient[] = [
      ...studentIds.map((id) => ({ role: "STUDENT" as const, id })),
      ...parentLinks.map((l) => ({ role: "PARENT" as const, id: l.parentId })),
      ...teachers.filter((t) => !guidanceIds.has(t.id)).map((t) => ({ role: "TEACHER" as const, id: t.id })),
      ...guidance,
    ];

    await notify({
      institutionId,
      recipients,
      eventType: "announcement.published",
      title: `Yeni duyuru: ${announcement.title}`,
      body: announcement.content.slice(0, 140),
      href: null,
      actorName: announcement.authorName,
    });
  } catch {
    // Duyuru zaten yayınlandı; bildirim yan iştir.
  }
}
