import { cookies } from "next/headers";
import { prisma } from "@/lib/server/prisma";
import { verifySessionToken, ROLE_ID_BY_AUTH_ROLE, SESSION_COOKIE_NAME, type SessionPayload, type RoleId } from "./jwt";
import { AuthError } from "./errors";

// Korumalı TÜM API route'larının (bkz. FAZ 1 planı) tek gerçek giriş noktası.
// Buradan geçmeyen hiçbir uç, request.cookies'i kendi başına okumamalı —
// aksi halde institution.isActive kontrolü (kurum askıya alma) atlanabilir.
export type Session = SessionPayload;

export async function requireSession(): Promise<Session> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new AuthError("Oturum bulunamadı. Lütfen giriş yapın.", "NO_SESSION", 401);
  }
  const payload = await verifySessionToken(token);
  // institutionId, çoklu-kurum geçişinden ÖNCE imzalanmış eski token'larda
  // yok — imza hâlâ geçerli olsa bile bu durumda oturum geçersiz sayılır
  // (aksi halde institutionId: undefined ile Prisma sorgusu ham bir 500
  // fırlatır). Kullanıcı basitçe tekrar giriş yapmalıdır.
  if (!payload || !payload.institutionId) {
    throw new AuthError("Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.", "INVALID_SESSION", 401);
  }

  // JWT'nin kendisi hâlâ geçerli olsa bile (7 güne kadar) kurum bu süre
  // içinde askıya alınmış olabilir — bu yüzden her istekte DB'den tazelenir.
  // Bu, statik JWT'ler için pratik tek anlık-iptal (kill-switch) yoludur.
  const institution = await prisma.institution.findUnique({
    where: { id: payload.institutionId },
    select: { isActive: true },
  });
  if (!institution || !institution.isActive) {
    throw new AuthError("Kurum hesabınız askıya alınmış. Lütfen yöneticinizle iletişime geçin.", "INSTITUTION_SUSPENDED", 403);
  }

  return payload;
}

export function requireRole(session: Session, ...roles: RoleId[]): void {
  const actual = ROLE_ID_BY_AUTH_ROLE[session.role];
  if (!roles.includes(actual)) {
    throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);
  }
}

// Bir kaydın institutionId'si oturumun kurumuyla eşleşmiyorsa 404 döner —
// 403 DEĞİL, çünkü 403 "kayıt var ama erişemiyorsun" der ve bu da başka bir
// kurumun kaydının VARLIĞINI sızdırır. Kurumlar birbirinin kayıtlarının var
// olup olmadığını dahi bilmemelidir.
export function requireInstitution(session: Session, recordInstitutionId: string): void {
  if (session.institutionId !== recordInstitutionId) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

// Oturum sahibinin, kendi id'si dışında bir kaydı görüntülemeye/değiştirmeye
// çalışıp çalışmadığını denetler (örn. bir öğrencinin /api/students/[id]
// ucunda KENDİ id'si dışında bir id istemesi).
export function assertOwnsSelf(session: Session, targetId: string): void {
  if (session.sub !== targetId) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

// Bir öğretmenin bir öğrenciye erişimi üç yoldan biriyle meşrudur: öğrencinin
// danışman öğretmeni olmak, öğrencinin şubesinin danışmanı olmak, ya da o
// şubede ders veren branş öğretmenlerinden biri olmak (teachingBranches —
// bkz. prisma/schema.prisma > Branch.teachingStaff notu).
export async function assertTeacherOwnsStudent(teacherId: string, studentId: string): Promise<void> {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      OR: [
        { advisorTeacherId: teacherId },
        { branch: { advisorId: teacherId } },
        { branch: { teachingStaff: { some: { id: teacherId } } } },
      ],
    },
    select: { id: true },
  });
  if (!student) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

export async function assertParentOwnsStudent(parentId: string, studentId: string): Promise<void> {
  const link = await prisma.parentStudent.findFirst({
    where: { parentId, studentId },
    select: { id: true },
  });
  if (!link) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}
