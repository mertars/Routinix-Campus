import { prisma } from "@/lib/server/prisma";
import { GUIDANCE_SUBJECT } from "@/lib/server/auth/otp";
import type { AuthRole, RoleId } from "@/lib/server/auth/jwt";

// ----------------------------------------------------------------------------
// Önizlenecek GERÇEK kullanıcıyı bulur.
//
// Panel önizlemesi sahte bir kimlikle çalışmaz — kurumun GERÇEK bir
// yöneticisinin/öğretmeninin/öğrencisinin/velisinin/rehberinin kimliğiyle
// açılır; "tıpkı uygulamadan girmiş biri gibi" görünmesinin tek yolu bu
// (uydurulmuş bir id, ilişkileri olmadığı için her ekranı boş gösterirdi).
//
// ⚠️ Kimlikler SADECE seçilen kurumun içinden gelir — her sorguda
// institutionId filtresi vardır. Platform sahibi bir kurumu önizlerken
// yanlışlıkla başka bir kurumun kullanıcısına bürünemez.
//
// ⚠️ Şifre/hash HİÇBİR ZAMAN okunmaz veya döndürülmez. Önizleme, hesabın
// şifresini bilmeyi gerektirmez ve şifreyi ifşa da etmez.
// ----------------------------------------------------------------------------

export const PREVIEW_ROLES: RoleId[] = ["principal", "teacher", "student", "parent", "guidance"];

export const AUTH_ROLE_BY_PREVIEW_ROLE: Record<RoleId, AuthRole> = {
  principal: "ADMIN",
  teacher: "TEACHER",
  student: "STUDENT",
  parent: "PARENT",
  guidance: "GUIDANCE",
};

export type PreviewTarget = {
  id: string;
  name: string;
  /** Seçim listesinde ismin altında görünen ayırt edici bilgi (branş, şube, çocuk). */
  detail: string;
  phone: string;
};

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Bir kurumdaki, verilen rol için önizlenebilecek gerçek kullanıcılar.
 * İlk sıradaki kayıt varsayılan seçimdir.
 *
 * Pasifleştirilmiş (isActive=false) öğrenci/öğretmen listeye GİRMEZ —
 * onların paneli zaten gerçek hayatta da açılmıyor (bkz. otp.ts >
 * findAccountByPhone), önizlemede açılması yanıltıcı olurdu.
 */
export async function listPreviewTargets(institutionId: string, role: RoleId, limit = 50): Promise<PreviewTarget[]> {
  if (role === "principal") {
    const admins = await prisma.admin.findMany({
      where: { institutionId },
      select: { id: true, firstName: true, lastName: true, title: true, authorityLevel: true, institutionalMobile: true },
      // SUPER_ADMIN alfabetik olarak BRANCH_MANAGER/COORDINATOR'dan önce gelir —
      // kurumun en yetkili yöneticisi varsayılan olsun diye (en geniş panel görünümü).
      orderBy: [{ authorityLevel: "asc" }, { firstName: "asc" }],
      take: limit,
    });
    return admins.map((a) => ({
      id: a.id,
      name: fullName(a.firstName, a.lastName),
      detail: a.title,
      phone: a.institutionalMobile,
    }));
  }

  if (role === "teacher" || role === "guidance") {
    const teachers = await prisma.teacher.findMany({
      // Rehberlik personası, Teacher.subject === "Rehberlik" olan kayıttır
      // (ayrı tablo YOK — bkz. lib/server/auth/otp.ts'teki aynı gerekçe).
      where: {
        institutionId,
        isActive: true,
        subject: role === "guidance" ? GUIDANCE_SUBJECT : { not: GUIDANCE_SUBJECT },
      },
      select: { id: true, firstName: true, lastName: true, subject: true, mobilePhone: true },
      orderBy: [{ firstName: "asc" }],
      take: limit,
    });
    return teachers.map((t) => ({
      id: t.id,
      name: fullName(t.firstName, t.lastName),
      detail: t.subject,
      phone: t.mobilePhone,
    }));
  }

  if (role === "student") {
    const students = await prisma.student.findMany({
      where: { institutionId, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true, branch: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }],
      take: limit,
    });
    return students.map((s) => ({
      id: s.id,
      name: fullName(s.firstName, s.lastName),
      detail: s.branch?.name ?? "Şubesiz",
      phone: s.phone ?? "",
    }));
  }

  const parents = await prisma.parent.findMany({
    where: { institutionId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobilePhone: true,
      students: { select: { student: { select: { firstName: true, lastName: true } } }, take: 3 },
    },
    orderBy: [{ firstName: "asc" }],
    take: limit,
  });
  // Çocuğu OLMAYAN veli listeye girmez: veli paneli tamamen çocuk seçimi
  // üzerine kurulu, böyle bir hesapta önizleme boş bir ekran gösterirdi.
  return parents
    .filter((p) => p.students.length > 0)
    .map((p) => ({
      id: p.id,
      name: fullName(p.firstName, p.lastName),
      detail: p.students.map((c) => fullName(c.student.firstName, c.student.lastName)).join(", "),
      phone: p.mobilePhone,
    }));
}

/** Önizlemenin açılacağı panel adresi — gerçek giriş sonrası gidilen yerin AYNISI. */
export const PANEL_PATH_BY_ROLE: Record<RoleId, string> = {
  // ⚠️ Yönetici gerçek girişte ÖNCE /hub'a (modül seçim ekranı) düşer, ama
  // önizlemenin amacı PANELİ incelemek — bir tık fazladan yol açmamak için
  // doğrudan /principal açılır. /hub önizlemede de erişilebilir kalır.
  principal: "/principal",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
  guidance: "/guidance",
};

export const ROLE_LABEL: Record<RoleId, string> = {
  principal: "Yönetici",
  teacher: "Öğretmen",
  student: "Öğrenci",
  parent: "Veli",
  guidance: "Rehberlik",
};
