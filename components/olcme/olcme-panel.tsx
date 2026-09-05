"use client";

import { ExamListView } from "./exam-list-view";
import { ExamDetailView } from "./exam-detail-view";

// Ölçme Değerlendirme — Hub'daki 3. modül (2026-09-05'te sıfırdan
// yeniden yazıldı).
//
// Önceki sürüm tek bir devasa ekranda "şablon listesi + ders yönetimi +
// cevap anahtarı + optik yükleme + kazanım + özet" işlerini yan yana
// gösteriyordu; kullanıcı haklı olarak çözemediğini söyledi. Yeni yapı iki
// ekrana ayrıldı ve her ekranın TEK bir işi var:
//
//   1. Liste  — hangi denemeler var, hangisi hangi aşamada (kart görünümü)
//   2. Detay  — seçili denemenin dört adımı: Cevap Anahtarı → Sonuçları
//               Yükle → Rapor → Kazanım (opsiyonel)
//
// Cevap anahtarı ve sonuçlar BAŞTAN SONA metin olarak alınır (kullanıcı
// kuralı): anahtar "ABCDE…" dizisi, sonuçlar optik tarayıcının ürettiği
// sabit-genişlikli .txt. Soru sayısı metnin uzunluğundan anlaşılır, ayrıca
// sorulmaz.
//
// examId sayfa düzeyinde tutulur (bkz. app/olcme/*/page.tsx) çünkü üst
// bardaki "Geçmiş Denemeler" seçicisi de aynı state'i değiştirir.
export function OlcmePanel({ examId, onSelectExam }: { examId: string; onSelectExam: (examId: string) => void }) {
  if (!examId) return <ExamListView onSelect={onSelectExam} />;
  return <ExamDetailView examId={examId} onBack={() => onSelectExam("")} />;
}
