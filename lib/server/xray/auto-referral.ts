import { prisma } from "@/lib/server/prisma";

const DEDUPE_WINDOW_DAYS = 14;

// Faz S — "kırmızı bölge tespit edildiğinde rehberlik sevkine otomatik
// taslak sevk kaydı oluşturulması". GuidanceReferral.teacherId ZORUNLU
// bir FK'dır ve BİLİNÇLİ olarak "sistem" diye bir kavram YOK (bkz. şema
// yorumu — "yöneticinin/rehberliğin kendi öğretmen kimliği yok, bu yüzden
// SADECE öğretmen oluşturabilir"). Şemayı DEĞİŞTİRMEK yerine (nullable
// teacherId, mevcut manuel akışın davranışını bozma riski) otomatik sevk
// öğrencinin DANIŞMAN öğretmenine atfedilir — zaten "bu öğrenciden
// sorumlu" olan kişi. Danışmanı yoksa hiçbir şey oluşturulmaz (atfedilecek
// kimse yok, sessizce atlanır — hata değil).
//
// Rehberlikçi tarafının PENDING kuyruğunu gösteren ekran HENÜZ YOK (bkz.
// app/api/guidance-referrals/route.ts yorumu, ayrı bir PART) — bu yüzden
// "yönetici onaylayınca kesinleşir" akışı için PENDING durumu zaten doğru
// kapıdır: rehberlik/yönetici bu kayıtları ne zaman görüntüleyebilir hale
// gelirse (o ekran kurulunca) inceleyip REVIEWED'a çekecek, ayrı bir
// "taslak" durumu icat etmeye gerek yok.
//
// Aynı öğrenciye kısa sürede onlarca ayrı sevk açılmasını önlemek için
// (aynı öğrenci farklı testlerde/kazanımlarda tekrar tekrar kırmızı
// çıkabilir) son DEDUPE_WINDOW_DAYS içinde HERHANGİ bir sebeple açılmış
// PENDING bir sevk varsa yeni kayıt oluşturulmaz.
export async function maybeCreateAutoReferral(studentId: string, subject: string, subtopicName: string, masteryScore: number): Promise<void> {
  if (masteryScore >= 30) return;

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { advisorTeacherId: true } });
  if (!student?.advisorTeacherId) return;

  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentPending = await prisma.guidanceReferral.findFirst({
    where: { studentId, status: "PENDING", createdAt: { gte: cutoff } },
    select: { id: true },
  });
  if (recentPending) return;

  await prisma.guidanceReferral.create({
    data: {
      studentId,
      teacherId: student.advisorTeacherId,
      reason: `Otomatik: Akademik Röntgen'de ${subject} dersinde ${subtopicName} konusunda kırmızı bölge tespit edildi (%${masteryScore}).`,
    },
  });
}
