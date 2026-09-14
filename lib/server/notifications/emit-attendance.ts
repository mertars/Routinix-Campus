import { prisma } from "@/lib/server/prisma";
import { notify, admins, teacherName, branchName } from "@/lib/server/notifications/activity";

// Yoklama bildirimlerinin TEK yeri.
//
// Ayrı bir dosyada çünkü iki alıcı kitlesi ve toplu sorgu optimizasyonu
// birleşince rota içinde 40 satır tutuyordu — rotanın asıl işi (doğrulama +
// kayıt) okunmaz hâle geliyordu.
//
// ⚠️ Sorgu sayısı öğrenci başına DEĞİL sabit: devamsız öğrencilerin velileri
// ve adları TEK sorguda toplanıyor. 30 kişilik bir sınıfta 5 devamsız varsa
// eskiden 10 ek sorgu olurdu, şimdi 2.
export async function emitAttendanceNotifications(input: {
  institutionId: string;
  teacherId: string;
  branchId: string;
  slot: string;
  subject: string;
  records: { studentId: string; status: string }[];
}): Promise<void> {
  try {
    const { institutionId, teacherId, branchId, slot, subject, records } = input;
    const [actor, branch] = await Promise.all([teacherName(teacherId), branchName(branchId)]);

    const absentCount = records.filter((r) => r.status === "ABSENT").length;

    await notify({
      institutionId,
      recipients: await admins(institutionId),
      eventType: "attendance.submitted",
      title: `${actor}, ${branch} yoklamasını girdi`,
      body: `${subject} · ${slot} · ${records.length} öğrenci${absentCount > 0 ? ` · ${absentCount} devamsız` : ""}`,
      href: "/principal?tab=attendance",
      actorName: actor,
    });

    // Yalnızca gelmeyen/geç kalan öğrencilerin velisine.
    const flagged = records.filter((r) => r.status === "ABSENT" || r.status === "LATE");
    if (flagged.length === 0) return;

    const studentIds = flagged.map((r) => r.studentId);
    const [links, students] = await Promise.all([
      prisma.parentStudent.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, parentId: true } }),
      prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } }),
    ]);

    const parentsByStudent = new Map<string, string[]>();
    for (const l of links) {
      const list = parentsByStudent.get(l.studentId) ?? [];
      list.push(l.parentId);
      parentsByStudent.set(l.studentId, list);
    }
    const nameById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

    for (const record of flagged) {
      const parentIds = parentsByStudent.get(record.studentId) ?? [];
      if (parentIds.length === 0) continue;
      const name = nameById.get(record.studentId) ?? "Öğrenciniz";
      await notify({
        institutionId,
        recipients: parentIds.map((id) => ({ role: "PARENT" as const, id })),
        eventType: "attendance.absent",
        title: record.status === "ABSENT" ? `${name} derse gelmedi` : `${name} derse geç kaldı`,
        body: `${branch} · ${subject} · ${slot}`,
        href: "/parent?tab=attendance",
        actorName: actor,
        urgent: record.status === "ABSENT",
      });
    }
  } catch {
    // Bildirim yan iştir — yoklamanın kendisi zaten kaydedildi.
  }
}
