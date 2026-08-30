import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. components/pdf/pdf-report-card.tsx (gradyanlı sertifika) ve
// pdf-exam-document.tsx (bilet/manifesto) — BİLEREK ÜÇÜNCÜ bir tasarım
// dili: bu belge bir yöneticiye/veliye değil DOĞRUDAN ÖĞRENCİYE gidiyor,
// bu yüzden "resmi belge" değil "kişisel hedef günlüğü/ajanda" hissi
// veriyor — düz renkli (gradyansız) yumuşak bir özet şeridi + her gün için
// zaman çizelgesi (timeline) noktası + ders bazlı renkli check-list satırları.
const COLORS = {
  pageBg: "#FFFFFF",
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  heroBg: "#FFF1E4",
  hairline: "#EDE7DC",
  emptyBg: "#FAF8F4",
  targetPillBg: "#F5F2EB",
  noteBg: "#FDF6EC",
  noteBorder: "#F0DCB8",
};

// Ders adına göre KARARLI (deterministik) bir renk seçer — aynı ders her
// zaman aynı rengi alır, öğrenci haftadan haftaya renk-ders eşleşmesini
// öğrenip programı daha hızlı tarayabilir.
const SUBJECT_PALETTE = [
  { bg: "#FDE7E3", text: "#B4472F" },
  { bg: "#E6F0E4", text: "#3E7A4C" },
  { bg: "#E3EEFB", text: "#2B5FA3" },
  { bg: "#EFE6F7", text: "#6B3FA0" },
  { bg: "#FBF0D9", text: "#96700A" },
  { bg: "#DFF2EF", text: "#1F7A6C" },
];

function subjectColor(subject: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash + subject.charCodeAt(i)) % SUBJECT_PALETTE.length;
  return SUBJECT_PALETTE[hash];
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 36, fontSize: 9.5 },

  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logoImage: { width: 26, height: 26, borderRadius: 7, objectFit: "contain" },
  logoFallback: { width: 26, height: 26, borderRadius: 7, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  institutionName: { fontSize: 9.5, fontWeight: "bold", color: COLORS.textMuted, marginLeft: 8, letterSpacing: 0.3 },

  heroTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 6 },

  heroBar: { backgroundColor: COLORS.heroBg, borderRadius: 16, padding: 11, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  heroAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 12 },
  heroAvatarText: { fontSize: 15, fontWeight: "bold", color: COLORS.accentDark },
  heroStudentName: { fontSize: 12.5, fontWeight: "bold" },
  heroWeekLabel: { fontSize: 8.5, color: COLORS.textMuted, marginTop: 1 },
  heroStatsRow: { flexDirection: "row", gap: 8, marginLeft: "auto" },
  heroStatPill: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center" },
  heroStatNumber: { fontSize: 13, fontWeight: "bold", color: COLORS.accentDark },
  heroStatLabel: { fontSize: 6.5, color: COLORS.textMuted, letterSpacing: 0.5, marginTop: 1 },

  dayRow: { flexDirection: "row", marginBottom: 2 },
  timelineCol: { width: 34, alignItems: "center" },
  dayDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  dayDotEmpty: { backgroundColor: COLORS.hairline },
  dayDotText: { fontSize: 7, fontWeight: "bold", color: "#FFFFFF" },
  dayDotTextEmpty: { color: COLORS.textMuted },
  timelineStem: { width: 2, flex: 1, backgroundColor: COLORS.hairline, marginTop: 2, marginBottom: 2 },

  dayContent: { flex: 1, paddingLeft: 12, paddingBottom: 5 },
  dayName: { fontSize: 10, fontWeight: "bold", marginBottom: 3, marginTop: 1 },

  entryRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.emptyBg, borderRadius: 9, padding: 5.5, marginBottom: 3 },
  checkbox: { width: 11, height: 11, borderRadius: 3, borderWidth: 1.4, borderColor: COLORS.accent, marginRight: 9 },
  entryTime: { width: 62, fontSize: 8, color: COLORS.textMuted },
  subjectPill: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginRight: 8 },
  subjectPillText: { fontSize: 8, fontWeight: "bold" },
  entryTopic: { flex: 1, fontSize: 9 },
  targetPill: { backgroundColor: COLORS.targetPillBg, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 8 },
  targetPillText: { fontSize: 7.5, fontWeight: "bold", color: COLORS.textMuted },

  emptyDayText: { fontSize: 8.5, color: COLORS.textMuted, marginTop: 2, marginBottom: 3, fontStyle: "normal" },

  noteBox: { backgroundColor: COLORS.noteBg, borderWidth: 1, borderColor: COLORS.noteBorder, borderRadius: 12, padding: 9, marginTop: 4, marginBottom: 8 },
  noteLabel: { fontSize: 8, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 0.8, marginBottom: 4 },
  noteText: { fontSize: 8.8, color: "#5C4632", lineHeight: 1.35 },

  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: COLORS.hairline, marginTop: 8, paddingTop: 4, fontSize: 8.5, color: COLORS.textMuted },
  watermarkRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },
});

export type GuidanceProgramEntryRow = { day: string; time: string; subject: string; topic: string; questionTarget: number };

export type PdfGuidanceProgramProps = {
  institutionName: string;
  logoUrl?: string | null;
  studentName: string;
  weekLabel: string;
  days: readonly string[];
  entries: GuidanceProgramEntryRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 Part 5 (tasarım güncellemesi) — Rehberlik & A4 Program
// Yapıcı'nın "Kurumsal A4 PDF Çıktısı" özelliği artık bir "kişisel hedef
// günlüğü" gibi tasarlanıyor: soldaki zaman çizelgesi (timeline) noktaları
// günden güne akışı gösterir, her hedef ders bazlı renkli bir check-list
// satırı olarak görünür (bkz. subjectColor — aynı ders her zaman aynı
// rengi alır). Eski window.print() tabanlı önizleme (a4-program-preview.tsx,
// SİLİNDİ) Framer Motion transform'u yüzünden boş sayfa üretiyordu; bu
// component diğer tüm PDF çıktıları gibi sunucu tarafında üretiliyor.
export function PdfGuidanceProgram({ institutionName, logoUrl, studentName, weekLabel, days, entries }: PdfGuidanceProgramProps) {
  const activeDayCount = new Set(entries.map((e) => e.day)).size;
  const totalTarget = entries.reduce((sum, e) => sum + e.questionTarget, 0);

  return (
    <Document title={t(`${studentName} - Haftalik Calisma Programi`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
            <Image src={logoUrl} style={styles.logoImage} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.institutionName}>{t(institutionName).toUpperCase()}</Text>
        </View>

        <Text style={styles.heroTitle}>{t("Haftalık Çalışma Programım")}</Text>

        <View style={styles.heroBar}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{t(studentName).charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.heroStudentName}>{t(studentName)}</Text>
            <Text style={styles.heroWeekLabel}>{t(weekLabel)}</Text>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatNumber}>{String(activeDayCount)}</Text>
              <Text style={styles.heroStatLabel}>{t("AKTİF GÜN")}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatNumber}>{String(totalTarget)}</Text>
              <Text style={styles.heroStatLabel}>{t("HEDEF SORU")}</Text>
            </View>
          </View>
        </View>

        {days.map((day, dayIndex) => {
          const dayEntries = entries.filter((entry) => entry.day === day);
          const isEmpty = dayEntries.length === 0;
          const isLast = dayIndex === days.length - 1;
          return (
            <View key={day} style={styles.dayRow} wrap={false}>
              <View style={styles.timelineCol}>
                <View style={[styles.dayDot, isEmpty ? styles.dayDotEmpty : undefined]}>
                  <Text style={[styles.dayDotText, isEmpty ? styles.dayDotTextEmpty : undefined]}>{t(day).slice(0, 3).toUpperCase()}</Text>
                </View>
                {!isLast && <View style={styles.timelineStem} />}
              </View>
              <View style={styles.dayContent}>
                <Text style={styles.dayName}>{t(day)}</Text>
                {isEmpty ? (
                  <Text style={styles.emptyDayText}>{t("Bu gün için hedef girilmedi.")}</Text>
                ) : (
                  dayEntries.map((entry, index) => {
                    const color = subjectColor(entry.subject);
                    return (
                      <View key={index} style={styles.entryRow}>
                        <View style={styles.checkbox} />
                        <Text style={styles.entryTime}>{t(entry.time)}</Text>
                        <View style={[styles.subjectPill, { backgroundColor: color.bg }]}>
                          <Text style={[styles.subjectPillText, { color: color.text }]}>{t(entry.subject)}</Text>
                        </View>
                        <Text style={styles.entryTopic}>{t(entry.topic)}</Text>
                        <View style={styles.targetPill}>
                          <Text style={styles.targetPillText}>{t(`${entry.questionTarget} soru`)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>{t("REHBER ÖĞRETMEN NOTU")}</Text>
          <Text style={styles.noteText}>
            {t(
              "Bu program haftalık takibe göre esnetilebilir; her gün için belirtilen hedef soru sayısına ulaşıldığında ilgili konu tamamlanmış sayılır."
            )}
          </Text>
        </View>

        <Text style={styles.signatureLine}>{t("Rehber Öğretmen")}</Text>

        <View style={styles.watermarkRow}>
          <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
