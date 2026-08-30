import { prisma } from "@/lib/server/prisma";

// app/api/admin/users/directory (kurum yöneticisi) VE
// app/api/platform/institutions/[id]/users/directory (platform sahibi, aynı
// düzenlenebilir liste — kalem ikonuyla) AYNI sorguları paylaşır.
export async function listStudentDirectory(institutionId: string, opts: { query?: string; branchId?: string; includeInactive?: boolean }) {
  const students = await prisma.student.findMany({
    where: {
      institutionId,
      isActive: opts.includeInactive ? undefined : true,
      branchId: opts.branchId || undefined,
      OR: opts.query
        ? [{ firstName: { contains: opts.query, mode: "insensitive" } }, { lastName: { contains: opts.query, mode: "insensitive" } }, { studentNumber: { contains: opts.query, mode: "insensitive" } }]
        : undefined,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      isActive: true,
      branch: { select: { id: true, name: true, grade: true } },
      // Toplu SMS alıcı seçicisi (bkz. components/principal/tabs/bulk-sms.tsx)
      // hangi öğrencinin velisinde SMS onayı (smsConsent) olduğunu seçim
      // ANINDA gösterebilsin diye — /api/admin/sms/send zaten onaysız
      // velileri sessizce atlıyor (bkz. lib/server/sms/scope-resolver.ts),
      // bu sadece o filtrenin ÖNCEDEN görünür olmasını sağlar.
      parents: { select: { parent: { select: { id: true, firstName: true, lastName: true, mobilePhone: true, smsConsent: true } } } },
    },
    orderBy: [{ firstName: "asc" }],
  });
  return students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    studentNumber: s.studentNumber,
    isActive: s.isActive,
    branchId: s.branch.id,
    branchName: s.branch.name,
    grade: s.branch.grade,
    parents: s.parents.map((link) => ({
      id: link.parent.id,
      name: `${link.parent.firstName} ${link.parent.lastName}`,
      mobilePhone: link.parent.mobilePhone,
      smsConsent: link.parent.smsConsent,
    })),
  }));
}

export async function listTeacherDirectory(institutionId: string, opts: { query?: string; subject?: string; includeInactive?: boolean }) {
  const teachers = await prisma.teacher.findMany({
    where: {
      institutionId,
      isActive: opts.includeInactive ? undefined : true,
      subject: opts.subject || undefined,
      OR: opts.query
        ? [
            { firstName: { contains: opts.query, mode: "insensitive" } },
            { lastName: { contains: opts.query, mode: "insensitive" } },
            { institutionalCode: { contains: opts.query, mode: "insensitive" } },
          ]
        : undefined,
    },
    select: { id: true, firstName: true, lastName: true, subject: true, mobilePhone: true, institutionalCode: true, isActive: true, advisorBranches: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }],
  });
  return teachers.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    subject: t.subject,
    mobilePhone: t.mobilePhone,
    institutionalCode: t.institutionalCode,
    isActive: t.isActive,
    branchNames: t.advisorBranches.map((b) => b.name),
  }));
}
