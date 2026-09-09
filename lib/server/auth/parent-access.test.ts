import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// BAŞKASININ VERİSİNE ERİŞİM — YAPISAL DENETİM.
//
// Elle tarandı: veli oturumuyla 23 uç × 3 hedef (kendi çocuğu / başka
// velinin çocuğu / başka kurumun öğrencisi), öğrenci oturumuyla açık
// uçlar, ve 9 müdür ucu. Tek sızıntı bulunmadı. Bu test o taramayı
// tekrarlamaz — amacı BUNDAN SONRA eklenecek korumasız bir ucu
// yakalamak.
//
// ⚠️ Bu testin ilk hâli YANLIŞ GÜVEN VERİYORDU: yalnızca
// `requireRole(session, ..., "parent")` yazan uçları arıyordu ve 22
// uçtan 4'ünü görüyordu. Çünkü uçların çoğu rolü hiç kısıtlamayıp
// sonra `session.role === "PARENT"` diye dallanıyor. Doğru kural
// rolde değil, ŞURADA: istekten öğrenci/öğretmen kimliği alan her uç
// bir sahiplik kontrolü yapmalı.

// Bilinen sahiplik kontrolü desenleri. Yerel yardımcılar da sayılır
// (örn. study-goals'daki assertIsOwnStudent, teacher-etut-availability'deki
// canManage) — koruma merkezî bir isim taşımak zorunda değil.
const GUARD_PATTERNS = [
  /assertParentOwnsStudent/,
  /assertTeacherOwnsStudent/,
  /assertOwnsSelf/,
  /assertIsOwnStudent/,
  /requireInstitution/,
  /canManage\s*\(/,
  /requirePaymentRole/,
  // Kimliği İSTEKTEN DEĞİL oturumdan türetmek de bir korumadır ve en
  // güçlüsüdür: istemci kimin adına işlem yaptığını seçemez.
  /=\s*session\.sub\b/,
  /studentId:\s*session\.sub\b/,
  /institutionId:\s*session\.institutionId\b/,
  // Satır içi kurum/kimlik karşılaştırması — en yaygın idiom:
  //   if (!teacher || teacher.institutionId !== session.institutionId) 404
  /!==\s*session\.institutionId\b/,
  /session\.institutionId\s*!==/,
  /!==\s*session\.sub\b/,
  /session\.sub\s*!==/,
  // Yerel olarak adlandırılmış erişim yardımcıları (assertQuizAccess gibi).
  /\bassert[A-Z]\w*Access\s*\(/,
  /\bcanManage\b/,
];

// ⚠️ Bu denetim SEZGİSELDİR: bir korumanın VAR OLDUĞUNU görür, DOĞRU
// olduğunu göremez. Yanlış yazılmış bir kontrol buradan geçer. Amacı,
// koruma eklemeyi tamamen UNUTAN bir ucu yakalamaktır; yerini gerçek
// uçtan uca sızıntı testine (bkz. bu fazın raporu) bırakmaz.

// Sadece yöneticiye açık uçlar bu denetimin dışındadır: requireRole ile
// zaten rol kapısından geçiyorlar.
const ADMIN_ONLY = /requireRole\(\s*session\s*,\s*("principal"|"teacher")/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^route\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("başkasının verisine erişim koruması", () => {
  const routes = walk("app/api").filter((f) => !f.includes("/platform/"));

  it("app/api taranabiliyor (test kendi kendini doğrular)", () => {
    // Klasör yapısı değişirse test sessizce "hiçbir şey bulamadım"
    // deyip yeşil kalmasın.
    expect(routes.length).toBeGreaterThan(100);
  });

  it("istekten kimlik alan her uçta bir sahiplik kontrolü var", () => {
    const ihlaller: string[] = [];

    for (const file of routes) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("requireSession")) continue;

      // İstekten başka birinin kimliğini alıyor mu? (URL parametresi,
      // sorgu dizesi veya gövde farketmez.)
      const takesForeignId =
        /params\.(studentId|teacherId|id)\b/.test(source) ||
        /searchParams\.get\(\s*"(studentId|teacherId)"/.test(source) ||
        /body[^\n]*\b(studentId|teacherId)\b/.test(source);
      if (!takesForeignId) continue;

      if (ADMIN_ONLY.test(source)) continue;
      if (GUARD_PATTERNS.some((p) => p.test(source))) continue;

      ihlaller.push(file.replace(/\\/g, "/"));
    }

    expect(
      ihlaller,
      `Bu uçlar istekten öğrenci/öğretmen kimliği alıyor ama tanınan bir ` +
        `sahiplik kontrolü içermiyor. Ya bir koruma ekleyin, ya kimliği ` +
        `session'dan türetin, ya da yeni bir koruma deseni kullanıyorsanız ` +
        `GUARD_PATTERNS'e ekleyin:\n${ihlaller.join("\n")}`
    ).toEqual([]);
  });

  it("denetim gerçekten iş görüyor — korumasız bir uç yakalanır", () => {
    // Testin kendisini test eder: kural doğru yazılmışsa aşağıdaki
    // uydurma kaynak ihlal sayılmalı.
    const korumasiz = `
      const session = await requireSession();
      const studentId = request.nextUrl.searchParams.get("studentId");
      const data = await prisma.student.findUnique({ where: { id: studentId } });
    `;
    const takesForeignId = /searchParams\.get\(\s*"(studentId|teacherId)"/.test(korumasiz);
    const korumaVar = GUARD_PATTERNS.some((p) => p.test(korumasiz));
    expect(takesForeignId).toBe(true);
    expect(korumaVar).toBe(false);
  });
});
