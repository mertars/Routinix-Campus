import { prisma } from "@/lib/server/prisma";

// Deneme sonucu hazır olduğunda öğrenci/veli panellerine bildirim —
// mevcut Announcement mekanizmasını kullanır (CUSTOM_ID_LIST kapsamı,
// bkz. app/api/announcements/route.ts'teki GET filtresine eklenen destek).
// Bu SİSTEMDE zaten var olan TEK "panele bildirim" yoludur: gerçek push
// bildirimi (mobil uygulama + Expo/Firebase) YOK (bkz. Deneme Analizi
// sohbetindeki dürüst açıklama) — Announcement, kullanıcı panele
// girdiğinde göreceği bir kayıttır, cihaza anlık push GÖNDERMEZ.
//
// Öğrenci VE veli AYNI duyuru akışını okur (bkz. GET /api/announcements
// ?studentId=, hem öğrenci hem veli aynı sahiplik kontrolüyle çağırır) —
// bu yüzden "öğrenciye" ve "veliye" için AYRI birer duyuru YOK, TEK
// duyuru ikisine de görünür.
export async function notifyExamResultReady(params: {
  institutionId: string;
  examId: string;
  examName: string;
  studentIds: string[];
  authorName: string;
  authorRole: "ADMIN" | "TEACHER";
}): Promise<void> {
  if (params.studentIds.length === 0) return;
  await prisma.announcement.create({
    data: {
      institutionId: params.institutionId,
      title: "Deneme Sonucun Hazır",
      content: `"${params.examName}" denemesinin sonuçları ve karnen artık panelinde görüntülenebilir.`,
      category: "GENERAL",
      scopeType: "CUSTOM_ID_LIST",
      scopeValue: params.studentIds.join(","),
      authorName: params.authorName,
      authorRole: params.authorRole,
    },
  });
}
