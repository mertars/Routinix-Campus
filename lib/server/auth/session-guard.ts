import { cookies } from "next/headers";
import { prisma } from "@/lib/server/prisma";
import { verifySessionToken, ROLE_ID_BY_AUTH_ROLE, SESSION_COOKIE_NAME, type SessionPayload, type RoleId } from "./jwt";
import { resolveActivePreview } from "./preview-jwt";
import { AuthError } from "./errors";

// Korumalı TÜM API route'larının (bkz. FAZ 1 planı) tek gerçek giriş noktası.
// Buradan geçmeyen hiçbir uç, request.cookies'i kendi başına okumamalı —
// aksi halde institution.isActive kontrolü (kurum askıya alma) atlanabilir.
//
// isPreview — oturum, platform sahibinin SALT OKUNUR panel önizlemesinden
// geliyor (bkz. lib/server/auth/preview-jwt.ts). Panel kodunun bunu bilmesine
// gerek YOKTUR (amaç "tıpkı uygulamadan girmiş biri gibi" görünmek); alan
// yalnızca denetim/teşhis için taşınır, yetki kararı VERMEZ — yazma kilidi
// tamamen ayrı iki katmanda uygulanır (bkz. lib/server/preview/read-only.ts).
export type Session = SessionPayload & { isPreview?: true; previewBy?: string };

export async function requireSession(): Promise<Session> {
  // ⚠️ ÖNCELİK KURALI: aktif bir önizleme, kurum oturumunun ÖNÜNE geçer —
  // ama "aktif" olması için o tarayıcıda geçerli bir PLATFORM SAHİBİ oturumu
  // da bulunmak zorundadır (bkz. preview-jwt.ts > resolveActivePreview,
  // kuralın neden böyle olduğu ve hangi gerçek hatadan doğduğu orada yazılı).
  // Aynı kural middleware.ts ve lib/server/preview/read-only.ts'te de birebir
  // uygulanır; üçü tutarlı olmak ZORUNDA, aksi halde sayfanın gördüğü kimlik
  // ile API'nin gördüğü kimlik ayrışır.
  const preview = await resolvePreviewSession();
  const token = preview ? null : cookies().get(SESSION_COOKIE_NAME)?.value;
  const payload = preview ?? (token ? await verifySessionToken(token) : null);

  if (!token && !payload) {
    throw new AuthError("Oturum bulunamadı. Lütfen giriş yapın.", "NO_SESSION", 401);
  }
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
  // Önizleme oturumu da AYNI kontrolden geçer: askıya alınmış bir kurumun
  // paneli platform sahibi için de açılmaz.
  const institution = await prisma.institution.findUnique({
    where: { id: payload.institutionId },
    select: { isActive: true },
  });
  if (!institution || !institution.isActive) {
    throw new AuthError("Kurum hesabınız askıya alınmış. Lütfen yöneticinizle iletişime geçin.", "INSTITUTION_SUSPENDED", 403);
  }

  return payload;
}

// Aktif önizlemeyi Session şekline çevirir. Ayrı 'aud' claim'i sayesinde
// buraya bir kurum/platform oturumu token'ı ASLA geçemez (bkz. preview-jwt.ts).
async function resolvePreviewSession(): Promise<Session | null> {
  const preview = await resolveActivePreview((name) => cookies().get(name)?.value);
  if (!preview) return null;
  return {
    sub: preview.sub,
    role: preview.role,
    phone: preview.phone,
    name: preview.name,
    institutionId: preview.institutionId,
    isPreview: true,
    previewBy: preview.previewBy,
  };
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
// Öğretmen bu öğrenciye erişebilir mi?
//
// ⚠️ DERS PROGRAMI da bir sahiplik kaynağıdır.
//
// Burada eskiden üç koşul vardı: öğrencinin özel danışmanı olmak,
// şubenin danışmanı olmak, ya da şubenin teachingStaff listesinde
// bulunmak. Üçü de o öğretmenin GERÇEKTE ders verdiği şubeleri
// kapsamıyordu — teachingStaff ilişkisi pratikte yalnızca danışman
// şubesiyle doluyor (bkz. lib/server/teachers/taught-branches.ts'teki
// aynı gerekçe).
//
// Ölçüldü: 12 öğretmenli bir kurumda öğretmenler toplam 1.062 öğrenciye
// ders veriyor ama bu kontrol yalnızca 108'ine izin veriyordu — %90'ı
// reddediliyordu. Öğretmen kendi dersine girdiği öğrencinin kaydını
// açamıyor, notunu göremiyor, rehberlik notu yazamıyordu.
export async function assertTeacherOwnsStudent(teacherId: string, studentId: string): Promise<void> {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      OR: [
        { advisorTeacherId: teacherId },
        { branch: { advisorId: teacherId } },
        { branch: { teachingStaff: { some: { id: teacherId } } } },
        // Programda o şubede dersi olan öğretmen o şubenin öğrencilerine erişir.
        { branch: { lessonSlots: { some: { teacherId } } } },
      ],
    },
    select: { id: true },
  });
  if (!student) {
    throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
  }
}

// Öğretmen bu ŞUBEDE ders veriyor mu?
//
// Sahiplik kaynakları assertTeacherOwnsStudent ile AYNI: şubenin
// danışmanı olmak, teachingStaff listesinde bulunmak ya da DERS
// PROGRAMINDA o şubede dersi olmak.
//
// ⚠️ Bu kontrol yokken öğretmen, ders VERMEDİĞİ şubelere ödev
// atayabiliyor, karne defterine not yazabiliyor, materyal
// yükleyebiliyor ve pop-quiz başlatabiliyordu (hepsi ölçüldü:
// Matematik öğretmeni ders vermediği 8-A'ya ödev oluşturdu, 201).
//
// Pop-quiz özellikle yıkıcı: bir şubede aynı anda tek canlı quiz
// olabildiği için yanlış şubede açılan bir quiz, O ŞUBENİN GERÇEK
// öğretmenini "zaten canlı bir Pop-Quiz var" hatasıyla kilitliyordu.
export async function assertTeacherTeachesBranch(teacherId: string, branchId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      OR: [
        { advisorId: teacherId },
        { teachingStaff: { some: { id: teacherId } } },
        { lessonSlots: { some: { teacherId } } },
      ],
    },
    select: { id: true },
  });
  if (!branch) {
    throw new AuthError("Bu şubede dersiniz görünmüyor.", "NOT_FOUND", 404);
  }
}

// Çoklu şube (örn. aynı ödevin birden fazla şubeye atanması). Biri bile
// uygun değilse işlem tamamen reddedilir — kısmen atanmış bir ödev,
// öğretmenin gördüğü listeyle öğrencilerin gördüğü liste arasında
// sessiz bir fark yaratır.
export async function assertTeacherTeachesBranches(teacherId: string, branchIds: string[]): Promise<void> {
  const allowed = await prisma.branch.count({
    where: {
      id: { in: branchIds },
      OR: [
        { advisorId: teacherId },
        { teachingStaff: { some: { id: teacherId } } },
        { lessonSlots: { some: { teacherId } } },
      ],
    },
  });
  if (allowed !== new Set(branchIds).size) {
    throw new AuthError("Ders vermediğiniz bir şube seçilmiş.", "NOT_FOUND", 404);
  }
}

// Bir ŞUBE verisini (yoklama listesi, materyal, sınıf defteri, müfredat
// ilerlemesi, oturma planı) OKUMA yetkisi — rol başına merdiven.
//
// ⚠️ 2026-09-15 denetiminde bulundu: bu ekranların OKUMA uçlarında şube
// kontrolü YOKTU, sadece "şube bu kurumda mı" bakılıyordu. Yazma yolları
// (POST/PUT) doğru şekilde assertTeacherTeachesBranch çağırıyordu ama AYNI
// dosyadaki GET çağırmıyordu. Sonuç: herhangi bir öğretmen başka bir sınıfın
// yoklamasını/sınıf defteri notlarını okuyabiliyor, bazı uçlarda (materyal,
// müfredat) rol kontrolü de olmadığı için öğrenci/veli bile okuyabiliyordu.
//
// Merdiven:
//   ADMIN     → kurumundaki her şube (zaten kurumu yönetiyor)
//   TEACHER   → yalnızca ders verdiği şubeler
//   GUIDANCE  → kurum geneli çalışır (sevk/görüşme şubeye bağlı değil)
//   STUDENT   → yalnızca kendi şubesi
//   PARENT    → yalnızca çocuklarının şubeleri
export async function assertCanReadBranch(session: Session, branchId: string): Promise<void> {
  const role = ROLE_ID_BY_AUTH_ROLE[session.role];

  if (role === "principal" || role === "guidance") return;

  if (role === "teacher") {
    await assertTeacherTeachesBranch(session.sub, branchId);
    return;
  }

  if (role === "student") {
    const student = await prisma.student.findFirst({
      where: { id: session.sub, branchId },
      select: { id: true },
    });
    if (!student) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    return;
  }

  if (role === "parent") {
    const link = await prisma.parentStudent.findFirst({
      where: { parentId: session.sub, student: { branchId } },
      select: { id: true },
    });
    if (!link) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    return;
  }

  throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
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
