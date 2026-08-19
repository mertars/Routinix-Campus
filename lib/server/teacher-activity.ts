// Gerçek bir öğrenci/veli anket-değerlendirme sistemi yok — bu yüzden
// "değerlendirme puanı" yerine gerçek etkinlik verisinden (yoklama + ödev +
// quiz sıklığı) türetilen, 0-100 arası şeffaf bir Aktiflik Skoru
// hesaplıyoruz. Hem tekil Performans Röntgeni hem toplu Öğretmen
// Performans Matrisi AYNI formülü kullanır (tutarlı, tek gerçek).
export function computeActivityScore(input: { attendanceSubmissionCount: number; homeworkCount: number; quizCount: number }): number {
  return Math.min(100, input.attendanceSubmissionCount * 4 + input.homeworkCount * 6 + input.quizCount * 8);
}
