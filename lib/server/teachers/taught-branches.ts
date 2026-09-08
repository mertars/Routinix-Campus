import { prisma } from "@/lib/server/prisma";

export type TaughtBranch = { id: string; name: string; grade: number; track: string | null };

// "Bu öğretmen hangi sınıflara giriyor?" sorusunun TEK doğru cevabı.
//
// Sistemde iki ayrı öğretmen–şube ilişkisi vardı ve birbirini
// bilmiyordu:
//   • LessonSlot        → ders programı; öğretmenin GERÇEKTEN ders
//                         verdiği şubeler
//   • teachingBranches  → yalnızca kullanıcı formundaki TEK "Danışman
//                         Şube" seçimiyle dolan ilişki
//
// Öğretmen panelinin 16 ekranı (yoklama, ödev, sınıf defteri, oturma
// düzeni…) İKİNCİSİNİ okuyordu. Gerçek testte 12 öğretmenin 12'sinin de
// ders programı doluydu ama teachingBranches'i boştu — yani müdür
// 120 derslik programı kurduğu halde HİÇBİR öğretmen yoklama alamıyordu
// ("Bugün bu şube için programda dersin görünmüyor").
//
// Çözüm okuma anında türetmek: senkron tutulacak ikinci bir kopya yok,
// dolayısıyla kayma da yok. "Danışman şube" ayrı bir kavram olarak
// KALIR (öğrencinin rehberi kim) — sadece "girdiği sınıflar" anlamında
// kullanılmaz.
export async function getTaughtBranches(teacherId: string): Promise<TaughtBranch[]> {
  const slots = await prisma.lessonSlot.findMany({
    where: { teacherId },
    select: { branch: { select: { id: true, name: true, grade: true, track: true } } },
    distinct: ["branchId"],
  });
  return slots
    .map((s) => s.branch)
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, "tr"));
}

// Çok öğretmen için tek sorguda — pano/performans listelerinde öğretmen
// başına ayrı sorgu atmak 12 öğretmende 12 gidiş dönüş demekti.
export async function getTaughtBranchesByTeacher(teacherIds: string[]): Promise<Map<string, TaughtBranch[]>> {
  if (teacherIds.length === 0) return new Map();
  const slots = await prisma.lessonSlot.findMany({
    where: { teacherId: { in: teacherIds } },
    select: { teacherId: true, branch: { select: { id: true, name: true, grade: true, track: true } } },
  });

  const map = new Map<string, Map<string, TaughtBranch>>();
  for (const slot of slots) {
    const byId = map.get(slot.teacherId) ?? new Map<string, TaughtBranch>();
    byId.set(slot.branch.id, slot.branch);
    map.set(slot.teacherId, byId);
  }

  const result = new Map<string, TaughtBranch[]>();
  for (const [teacherId, byId] of map) {
    result.set(
      teacherId,
      [...byId.values()].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, "tr"))
    );
  }
  return result;
}
