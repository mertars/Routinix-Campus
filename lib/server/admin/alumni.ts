import { prisma } from "@/lib/server/prisma";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { recordAuditLog } from "@/lib/server/audit/audit-log";

// Mezun Gurur Tablosu + Mentorluk — önceden tamamen mock veriydi (ALUMNI,
// lib/mock-data.ts). Bir "mezun", kurumda GERÇEKTEN kayıtlı bir Student'a
// bağlı bir PROFİL — ayrı bir kişi kaydı değil.

export async function listAlumniProfiles(institutionId: string) {
  const profiles = await prisma.alumniProfile.findMany({
    where: { student: { institutionId } },
    include: { student: { select: { firstName: true, lastName: true } } },
    orderBy: { graduationYear: "desc" },
  });
  return profiles.map((p) => ({
    id: p.id,
    studentId: p.studentId,
    name: `${p.student.firstName} ${p.student.lastName}`,
    graduationYear: p.graduationYear,
    highSchoolRank: p.highSchoolRank,
    admittedTo: p.admittedTo,
    examScope: p.examScope,
    isMentor: p.isMentor,
    mentorNote: p.mentorNote,
    contactPhone: p.contactPhone,
  }));
}

export async function createAlumniProfile(input: {
  institutionId: string;
  actorId: string;
  studentId: string;
  graduationYear: number;
  highSchoolRank?: string;
  admittedTo: string;
  examScope: "YKS" | "LGS";
  isMentor: boolean;
  mentorNote?: string;
  contactPhone?: string;
}) {
  const admittedTo = input.admittedTo.trim();
  if (!admittedTo) throw new AdminCreateError("Kabul edilen üniversite/bölüm zorunludur.");
  if (!input.graduationYear || input.graduationYear < 2000 || input.graduationYear > 2100) {
    throw new AdminCreateError("Geçerli bir mezuniyet yılı girin.");
  }

  const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { institutionId: true } });
  if (!student || student.institutionId !== input.institutionId) throw new AdminCreateError("Öğrenci bulunamadı.", 404);

  const existing = await prisma.alumniProfile.findUnique({ where: { studentId: input.studentId } });
  if (existing) throw new AdminCreateError("Bu öğrenci için zaten bir mezun profili var.", 409);

  const profile = await prisma.alumniProfile.create({
    data: {
      studentId: input.studentId,
      graduationYear: input.graduationYear,
      highSchoolRank: input.highSchoolRank?.trim() || undefined,
      admittedTo,
      examScope: input.examScope,
      isMentor: input.isMentor,
      mentorNote: input.isMentor ? input.mentorNote?.trim() || undefined : undefined,
      contactPhone: input.isMentor ? input.contactPhone?.trim() || undefined : undefined,
    },
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "ALUMNI_PROFILE_CREATED",
    targetType: "AlumniProfile",
    targetId: profile.id,
    metadata: { studentId: input.studentId, admittedTo },
  });

  return profile;
}

export async function deleteAlumniProfile(id: string, institutionId: string): Promise<void> {
  const profile = await prisma.alumniProfile.findUnique({ where: { id }, select: { student: { select: { institutionId: true } } } });
  if (!profile || profile.student.institutionId !== institutionId) throw new AdminCreateError("Mezun profili bulunamadı.", 404);
  await prisma.alumniProfile.delete({ where: { id } });
}

export async function listMentorRequestsForInstitution(institutionId: string) {
  const requests = await prisma.mentorRequest.findMany({
    where: { alumniProfile: { student: { institutionId } } },
    include: {
      alumniProfile: { include: { student: { select: { firstName: true, lastName: true } } } },
      requesterStudent: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return requests.map((r) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    createdAt: r.createdAt,
    mentorName: `${r.alumniProfile.student.firstName} ${r.alumniProfile.student.lastName}`,
    requesterName: `${r.requesterStudent.firstName} ${r.requesterStudent.lastName}`,
    requesterBranchName: r.requesterStudent.branch.name,
  }));
}

export async function resolveMentorRequest(input: { id: string; institutionId: string; status: "APPROVED" | "REJECTED" }) {
  const request = await prisma.mentorRequest.findUnique({
    where: { id: input.id },
    select: { alumniProfile: { select: { student: { select: { institutionId: true } } } } },
  });
  if (!request || request.alumniProfile.student.institutionId !== input.institutionId) {
    throw new AdminCreateError("Talep bulunamadı.", 404);
  }
  return prisma.mentorRequest.update({ where: { id: input.id }, data: { status: input.status, resolvedAt: new Date() } });
}
