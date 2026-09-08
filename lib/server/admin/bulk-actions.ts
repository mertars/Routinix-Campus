import { prisma } from "@/lib/server/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/server/auth/generate-credentials";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { deleteUserAccountPermanently } from "@/lib/server/admin/update-user";
import { toFriendlyDbError } from "@/lib/server/prisma-errors";
import { renewEnrollment, defaultEndDate } from "@/lib/server/enrollment/enrollment-service";
import { academicYearOf } from "@/lib/payments/academic-year";

// Kullanıcı listesindeki TOPLU işlemler.
//
// Testte müdürün en çok zaman kaybettiği yer buydu: 100 öğrenciyi tek
// tek pasifleştirmek, tek tek şifre sıfırlamak. Buradaki işlemler tek
// seçimle çalışır.
//
// İki kural her işlemde geçerli:
//
// 1) HİÇBİRİ "hep ya da hiç" DEĞİLDİR. 100 öğrencinin 3'ü bir kurala
//    takılıyorsa 97'si yine de yapılır ve takılan 3'ü SEBEBİYLE birlikte
//    döner. Tek bir kaydın hatası yüzünden müdürün işleminin tamamının
//    geri alınması, tek tek yapmaktan daha kötüdür.
// 2) Seçilen id'ler ÖNCE kuruma göre süzülür. İstemciden gelen id
//    listesine güvenilmez — başka kurumun kaydı listeye sokulsa bile
//    bu süzgeçten geçemez.

export const BULK_ACTIONS = [
  "DEACTIVATE",
  "REACTIVATE",
  "RESET_PASSWORD",
  "CHANGE_BRANCH",
  "PROMOTE_GRADE",
  "RENEW_ENROLLMENT",
  "DELETE",
] as const;

export type BulkAction = (typeof BULK_ACTIONS)[number];

// Öğretmenlerde anlamı olmayan işlemler — şube/kayıt dönemi öğrenciye özgü.
const STUDENT_ONLY: BulkAction[] = ["CHANGE_BRANCH", "PROMOTE_GRADE", "RENEW_ENROLLMENT"];

export type BulkItemResult = { id: string; name: string; ok: boolean; reason?: string };

export type BulkCredential = { fullName: string; username: string; password: string; phone?: string; institutionalCode?: string };

export type BulkResult = {
  action: BulkAction;
  total: number;
  succeeded: number;
  failed: number;
  items: BulkItemResult[];
  /** Yalnızca RESET_PASSWORD: yeni geçici şifreler (bir kez döner). */
  credentials?: BulkCredential[];
};

export type BulkInput = {
  action: BulkAction;
  role: "STUDENT" | "TEACHER";
  ids: string[];
  institutionId: string;
  actorId: string;
  /** CHANGE_BRANCH için hedef şube. */
  targetBranchId?: string;
  /** PROMOTE_GRADE için önizlemede ONAYLANMIŞ eşleme: kaynak şube → hedef şube. */
  branchMap?: Record<string, string>;
  /** RENEW_ENROLLMENT için yeni dönem bilgileri. */
  renewal?: { startDate: Date; endDate?: Date; listAmount?: number | null; installmentCount?: number | null };
};

// Tek seferde işlenebilecek kayıt sayısı. Üst sınır olmadan bir "tümünü
// seç" 5000 kaydı tek isteğe sokabilir ve zaman aşımına düşer; istemci
// zaten parça parça gönderiyor (bkz. lib/client/chunked-import.ts).
export const BULK_LIMIT = 200;

type Named = { id: string; firstName: string; lastName: string };
const fullName = (r: Named) => `${r.firstName} ${r.lastName}`;

// Kuruma ait olan kayıtları getirir; listede olmayanlar "bulunamadı"
// olarak sonuca yazılır (sessizce yutulmaz).
async function loadScoped(input: BulkInput) {
  const where = { id: { in: input.ids }, institutionId: input.institutionId };
  const rows =
    input.role === "STUDENT"
      ? await prisma.student.findMany({
          where,
          select: { id: true, firstName: true, lastName: true, isActive: true, studentNumber: true, phone: true, branchId: true },
        })
      : await prisma.teacher.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
            nationalId: true,
            mobilePhone: true,
            institutionalCode: true,
          },
        });

  const found = new Set(rows.map((r) => r.id));
  const missing: BulkItemResult[] = input.ids
    .filter((id) => !found.has(id))
    .map((id) => ({ id, name: id, ok: false, reason: "Kayıt bulunamadı." }));
  return { rows, missing };
}

function summarize(action: BulkAction, items: BulkItemResult[], credentials?: BulkCredential[]): BulkResult {
  const succeeded = items.filter((i) => i.ok).length;
  return { action, total: items.length, succeeded, failed: items.length - succeeded, items, credentials };
}

export async function runBulkAction(input: BulkInput): Promise<BulkResult> {
  if (!BULK_ACTIONS.includes(input.action)) throw new AdminCreateError("Geçersiz toplu işlem.", 400);
  if (!Array.isArray(input.ids) || input.ids.length === 0) throw new AdminCreateError("En az bir kayıt seçin.", 400);
  if (input.ids.length > BULK_LIMIT) {
    throw new AdminCreateError(`Tek seferde en fazla ${BULK_LIMIT} kayıt işlenebilir.`, 400);
  }
  if (input.role === "TEACHER" && STUDENT_ONLY.includes(input.action)) {
    throw new AdminCreateError("Bu işlem yalnızca öğrenciler için geçerlidir.", 400);
  }

  const { rows, missing } = await loadScoped(input);
  const result = await dispatch(input, rows as never[], missing);

  // Toplu işlem TEK denetim kaydı bırakır — 100 satır yerine "100
  // öğrenci pasifleştirildi". Tek tek kimin etkilendiği items içinde
  // döndüğü için ekranda zaten görünür.
  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "BULK_ACTION_APPLIED",
    targetType: input.role === "STUDENT" ? "Student" : "Teacher",
    targetId: `${result.succeeded} kayıt`,
    metadata: {
      bulkAction: input.action,
      role: input.role,
      succeeded: result.succeeded,
      failed: result.failed,
      // Şifreler ASLA loglanmaz — yalnızca kimin şifresinin sıfırlandığı.
      ids: result.items.filter((i) => i.ok).map((i) => i.id),
    },
  });

  return result;
}

type StudentRow = { id: string; firstName: string; lastName: string; isActive: boolean; studentNumber: string; phone: string | null; branchId: string };
type TeacherRow = { id: string; firstName: string; lastName: string; isActive: boolean; nationalId: string; mobilePhone: string; institutionalCode: string | null };
type AnyRow = StudentRow | TeacherRow;

async function dispatch(input: BulkInput, rows: AnyRow[], missing: BulkItemResult[]): Promise<BulkResult> {
  switch (input.action) {
    case "DEACTIVATE":
    case "REACTIVATE":
      return summarize(input.action, [...missing, ...(await setActive(input, rows))]);
    case "RESET_PASSWORD": {
      const { items, credentials } = await resetPasswords(input, rows);
      return summarize(input.action, [...missing, ...items], credentials);
    }
    case "CHANGE_BRANCH":
      return summarize(input.action, [...missing, ...(await changeBranch(input, rows as StudentRow[]))]);
    case "PROMOTE_GRADE":
      return summarize(input.action, [...missing, ...(await promoteGrade(input, rows as StudentRow[]))]);
    case "RENEW_ENROLLMENT":
      return summarize(input.action, [...missing, ...(await renewAll(input, rows as StudentRow[]))]);
    case "DELETE":
      return summarize(input.action, [...missing, ...(await deleteAll(input, rows))]);
  }
}

// Pasifleştir / aktifleştir.
//
// N ayrı update yerine TEK updateMany: 100 kayıt için 100 gidiş-geliş
// yerine bir tane. Zaten durumu doğru olanlar hata değil, "değişiklik
// yok" olarak işaretlenir — müdür 100 seçip 3'ünün zaten pasif olması
// bir kusur değildir.
async function setActive(input: BulkInput, rows: AnyRow[]): Promise<BulkItemResult[]> {
  const target = input.action === "REACTIVATE";
  const toChange = rows.filter((r) => r.isActive !== target);
  const ids = toChange.map((r) => r.id);

  if (ids.length > 0) {
    const data = { isActive: target };
    if (input.role === "STUDENT") await prisma.student.updateMany({ where: { id: { in: ids } }, data });
    else await prisma.teacher.updateMany({ where: { id: { in: ids } }, data });
  }

  return rows.map((r) => ({
    id: r.id,
    name: fullName(r),
    ok: true,
    reason: r.isActive === target ? (target ? "Zaten aktifti." : "Zaten pasifti.") : undefined,
  }));
}

// bcrypt bilerek yavaştır (~60ms). 100 kayıt için sırayla beklemek 6
// saniye eder; paralel hesaplanınca saniyenin altına iner.
async function resetPasswords(input: BulkInput, rows: AnyRow[]) {
  const plain = rows.map(() => generateTemporaryPassword());
  const hashes = await Promise.all(plain.map((p) => hashPassword(p)));

  await prisma.$transaction(
    rows.map((r, i) =>
      input.role === "STUDENT"
        ? prisma.student.update({ where: { id: r.id }, data: { passwordHash: hashes[i], mustChangePassword: true } })
        : prisma.teacher.update({ where: { id: r.id }, data: { passwordHash: hashes[i], mustChangePassword: true } })
    )
  );

  const credentials: BulkCredential[] = rows.map((r, i) => {
    const isStudent = input.role === "STUDENT";
    const s = r as StudentRow;
    const t = r as TeacherRow;
    return {
      fullName: fullName(r),
      username: isStudent ? s.studentNumber : t.nationalId,
      password: plain[i],
      phone: (isStudent ? s.phone : t.mobilePhone) ?? undefined,
      institutionalCode: isStudent ? undefined : (t.institutionalCode ?? undefined),
    };
  });

  return { items: rows.map((r) => ({ id: r.id, name: fullName(r), ok: true })), credentials };
}

async function changeBranch(input: BulkInput, rows: StudentRow[]): Promise<BulkItemResult[]> {
  if (!input.targetBranchId) throw new AdminCreateError("Hedef şube seçilmedi.", 400);
  const branch = await prisma.branch.findUnique({
    where: { id: input.targetBranchId },
    select: { institutionId: true, name: true },
  });
  if (!branch || branch.institutionId !== input.institutionId) throw new AdminCreateError("Şube bulunamadı.", 404);

  const moving = rows.filter((r) => r.branchId !== input.targetBranchId);
  if (moving.length > 0) {
    await prisma.student.updateMany({
      where: { id: { in: moving.map((r) => r.id) } },
      data: { branchId: input.targetBranchId },
    });
  }

  return rows.map((r) => ({
    id: r.id,
    name: fullName(r),
    ok: true,
    reason: r.branchId === input.targetBranchId ? `Zaten ${branch.name} şubesindeydi.` : undefined,
  }));
}

export type PromotionPair = {
  fromBranchId: string;
  fromBranchName: string;
  fromGrade: number;
  toBranchId: string | null;
  toBranchName: string | null;
  studentCount: number;
  /** Hedef bulunamadıysa sebebi — müdür önizlemede görüp şube açabilir. */
  problem?: string;
};

// Sınıf atlatma ÖNİZLEMESİ.
//
// Eşleme tahmindir: "11-A" → grade 12 olan ve adının şube harfi kısmı
// aynı olan şube. Bu yüzden doğrudan uygulanmaz — müdüre gösterilir,
// o onaylar (ya da hedefi elle değiştirir). 100 öğrenciyi yanlış şubeye
// taşımak, tek tek taşımaktan çok daha pahalı bir hatadır.
// Son kademe. 12'den sonra bir üst SINIF yoktur — devam eden öğrenci
// mezun grubuna geçer (bkz. BranchSegment.MEZUN).
const TOP_GRADE = 12;

// Şube adının kademe öneki atılmış hali: "11-Eşit Ağırlık" → "eşit ağırlık".
function branchSuffix(name: string): string {
  return name.replace(/^\s*\d+\s*[-–/]?\s*/, "").trim().toLocaleLowerCase("tr-TR");
}

export async function previewGradePromotion(institutionId: string, studentIds: string[]): Promise<PromotionPair[]> {
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, institutionId },
    select: { id: true, branchId: true, branch: { select: { id: true, name: true, grade: true, segment: true } } },
  });
  const branches = await prisma.branch.findMany({
    where: { institutionId },
    select: { id: true, name: true, grade: true, segment: true },
  });

  const byBranch = new Map<string, { name: string; grade: number; segment: string; count: number }>();
  for (const s of students) {
    const entry = byBranch.get(s.branchId) ?? { name: s.branch.name, grade: s.branch.grade, segment: s.branch.segment, count: 0 };
    entry.count += 1;
    byBranch.set(s.branchId, entry);
  }

  return [...byBranch.entries()].map(([fromBranchId, info]) => ({
    fromBranchId,
    fromBranchName: info.name,
    fromGrade: info.grade,
    studentCount: info.count,
    ...resolvePromotionTarget(info, branches),
  }));
}

export type BranchLike = { id: string; name: string; grade: number; segment: string };

// Bir şubenin bir üst kademedeki karşılığını bulur. Veritabanına
// dokunmaz — kural mantığı burada, testlerle sabitlenmiş halde durur.
export function resolvePromotionTarget(
  from: { name: string; grade: number; segment: string },
  branches: BranchLike[]
): { toBranchId: string | null; toBranchName: string | null; problem?: string } {
  // Mezun grubu zaten en üstte — atlatılacak bir üst sınıfı yok.
  if (from.segment === "MEZUN") {
    return {
      toBranchId: null,
      toBranchName: null,
      problem: "Mezun grubu bir üst sınıfa geçmez — bu öğrenciler olduğu yerde kalır.",
    };
  }

  // 12'nin üstü "13. sınıf" DEĞİLDİR. Sınavı kazanamayıp devam eden
  // öğrenci MEZUN grubuna geçer; kazanan zaten kurumdan ayrılır (mezun
  // kaydı ayrı bir işlemdir, bkz. /api/admin/alumni).
  if (from.grade >= TOP_GRADE) {
    const target = branches.find((b) => b.segment === "MEZUN") ?? null;
    return {
      toBranchId: target?.id ?? null,
      toBranchName: target?.name ?? null,
      problem: target
        ? undefined
        : "Mezun şubesi yok. Devam edecekler için bir mezun şubesi açın; kurumdan ayrılacaklar için mezun kaydı oluşturun.",
    };
  }

  const nextGrade = from.grade + 1;
  const suffix = branchSuffix(from.name);
  // Mezun şubesinin kademesi temsilîdir (12) — normal atlatmada hedef olamaz.
  const candidates = branches.filter((b) => b.grade === nextGrade && b.segment !== "MEZUN");
  const match = candidates.find((b) => branchSuffix(b.name) === suffix) ?? null;

  return {
    toBranchId: match?.id ?? null,
    toBranchName: match?.name ?? null,
    problem: match
      ? undefined
      : candidates.length === 0
        ? `${nextGrade}. sınıf şubesi yok — önce açmanız gerekiyor.`
        : `${nextGrade}. sınıfta "${suffix.toLocaleUpperCase("tr-TR")}" karşılığı bulunamadı — hedefi elle seçin.`,
  };
}

// Onaylanmış eşlemeyi uygular. Eşlemede karşılığı olmayan öğrenci
// TAŞINMAZ ve sebebiyle birlikte döner — sessizce atlanmaz.
async function promoteGrade(input: BulkInput, rows: StudentRow[]): Promise<BulkItemResult[]> {
  const map = input.branchMap ?? {};
  const targetIds = [...new Set(Object.values(map))];
  const valid = new Set(
    (
      await prisma.branch.findMany({
        where: { id: { in: targetIds }, institutionId: input.institutionId },
        select: { id: true },
      })
    ).map((b) => b.id)
  );

  const results: BulkItemResult[] = [];
  const moves = new Map<string, string[]>();

  for (const r of rows) {
    const to = map[r.branchId];
    if (!to) {
      results.push({ id: r.id, name: fullName(r), ok: false, reason: "Bu şube için hedef sınıf belirlenmedi." });
      continue;
    }
    if (!valid.has(to)) {
      results.push({ id: r.id, name: fullName(r), ok: false, reason: "Hedef şube bu kuruma ait değil." });
      continue;
    }
    moves.set(to, [...(moves.get(to) ?? []), r.id]);
    results.push({ id: r.id, name: fullName(r), ok: true });
  }

  // Hedef şube başına tek updateMany.
  for (const [branchId, ids] of moves) {
    await prisma.student.updateMany({ where: { id: { in: ids } }, data: { branchId } });
  }

  return results;
}

// Toplu kayıt yenileme (bkz. enrollment-service).
//
// Diğerlerinin aksine burada updateMany yapılamaz: her öğrenci için eski
// kayıt RENEWED'e çekilip yenisine zincirleniyor ve —ücret girildiyse—
// taksit planı kuruluyor. Bu yüzden sırayla, ama hatası olan öğrenci
// diğerlerini durdurmadan işlenir.
async function renewAll(input: BulkInput, rows: StudentRow[]): Promise<BulkItemResult[]> {
  const renewal = input.renewal;
  if (!renewal?.startDate) throw new AdminCreateError("Yeni dönem başlangıcı seçilmedi.", 400);
  const endDate = renewal.endDate ?? defaultEndDate(academicYearOf(renewal.startDate));

  const active = await prisma.studentEnrollment.findMany({
    where: { studentId: { in: rows.map((r) => r.id) }, institutionId: input.institutionId, status: "ACTIVE" },
    select: { id: true, studentId: true },
  });
  const enrollmentByStudent = new Map(active.map((e) => [e.studentId, e.id]));

  const results: BulkItemResult[] = [];
  for (const r of rows) {
    const enrollmentId = enrollmentByStudent.get(r.id);
    if (!enrollmentId) {
      results.push({ id: r.id, name: fullName(r), ok: false, reason: "Açık bir kayıt dönemi yok." });
      continue;
    }
    try {
      await renewEnrollment({
        institutionId: input.institutionId,
        enrollmentId,
        listAmount: renewal.listAmount ?? null,
        installmentCount: renewal.installmentCount ?? null,
        startDate: renewal.startDate,
        endDate,
        createdByAdminId: input.actorId,
      });
      results.push({ id: r.id, name: fullName(r), ok: true });
    } catch (error) {
      results.push({
        id: r.id,
        name: fullName(r),
        ok: false,
        reason: error instanceof Error ? error.message : "Yenilenemedi.",
      });
    }
  }
  return results;
}

// Kalıcı silme. Çoğu kayıt mali/akademik geçmişi yüzünden silinemez —
// bu bir kusur değil, korumadır; sebebi kayıt kayıt gösterilir.
async function deleteAll(input: BulkInput, rows: AnyRow[]): Promise<BulkItemResult[]> {
  const results: BulkItemResult[] = [];
  for (const r of rows) {
    try {
      await deleteUserAccountPermanently({
        id: r.id,
        role: input.role,
        institutionId: input.institutionId,
        actorId: input.actorId,
      });
      results.push({ id: r.id, name: fullName(r), ok: true });
    } catch (error) {
      const friendly = toFriendlyDbError(error, { deleting: input.role === "STUDENT" ? "Öğrenci" : "Öğretmen" });
      results.push({
        id: r.id,
        name: fullName(r),
        ok: false,
        reason:
          friendly?.message ??
          (error instanceof AdminCreateError ? error.message : "Silinemedi."),
      });
    }
  }
  return results;
}
