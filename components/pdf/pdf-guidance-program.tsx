import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. components/pdf/pdf-report-card.tsx — AYNI renk paleti/kurumsal kimlik.
const COLORS = {
  pageBg: "#FDFBF7",
  cardBg: "#F5F2EB",
  text: "#2C221E",
  textMuted: "#786C66",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#E6E1D5",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 42, fontSize: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 3, borderBottomColor: COLORS.accent, paddingBottom: 14, marginBottom: 18 },
  logoImage: { width: 40, height: 40, borderRadius: 8, objectFit: "contain" },
  logoFallback: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: COLORS.pageBg, fontSize: 18, fontWeight: "bold" },
  institutionName: { fontSize: 16, fontWeight: "bold", letterSpacing: -0.2 },
  subtitle: { fontSize: 9, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1.2, marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { color: COLORS.textMuted },
  metaValue: { fontWeight: "bold" },
  dayBlock: { marginBottom: 12 },
  dayTitle: { fontSize: 10, fontWeight: "bold", backgroundColor: COLORS.text, color: COLORS.pageBg, padding: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  entryRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline, backgroundColor: COLORS.cardBg },
  entryCellTime: { width: 90, padding: 6, fontSize: 9 },
  entryCellSubject: { width: 100, padding: 6, fontSize: 9, fontWeight: "bold" },
  entryCellTopic: { flex: 1, padding: 6, fontSize: 9 },
  entryCellTarget: { width: 80, padding: 6, fontSize: 9, textAlign: "right" },
  emptyRow: { padding: 8, fontSize: 9, color: COLORS.textMuted, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  noteBox: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 24 },
  noteLabel: { fontSize: 8, fontWeight: "bold", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  noteText: { fontSize: 9, color: COLORS.textMuted, lineHeight: 1.4 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 },
  signatureLabel: { fontSize: 8, color: COLORS.textMuted },
  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: COLORS.text, marginTop: 24, paddingTop: 4, fontSize: 9 },
  watermark: { position: "absolute", bottom: 24, right: 42, fontSize: 7, color: COLORS.textMuted, opacity: 0.55 },
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

// Kampüs V2 Part 5 (devam) — Rehberlik & A4 Program Yapıcı'nın "Kurumsal A4
// PDF Çıktısı" özelliği eskiden tarayıcının window.print()'ine + görünürlük
// hile'sine (bkz. eski a4-program-preview.tsx, artık SİLİNDİ) dayanıyordu —
// bu yaklaşım Framer Motion'ın modal'a uyguladığı transform'un position:fixed
// için YENİ bir containing block oluşturması yüzünden BOŞ SAYFA üretiyordu
// (bkz. components/ui/modal.tsx'teki AYNI kök nedenin dokümante edildiği
// not). Diğer tüm PDF çıktıları gibi artık @react-pdf/renderer ile sunucu
// tarafında, tarayıcıdan/print motorundan bağımsız üretiliyor.
export function PdfGuidanceProgram({ institutionName, logoUrl, studentName, weekLabel, days, entries }: PdfGuidanceProgramProps) {
  return (
    <Document title={t(`${studentName} - Haftalik Calisma Programi`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
            <Image src={logoUrl} style={styles.logoImage} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.institutionName}>{t(institutionName)}</Text>
            <Text style={styles.subtitle}>{t("HAFTALIK AKADEMİK ÇALIŞMA PROGRAMI")}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>{t("Öğrenci: ")}</Text>
            <Text style={styles.metaValue}>{t(studentName)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Hafta: ")}</Text>
            <Text style={styles.metaValue}>{t(weekLabel)}</Text>
          </Text>
        </View>

        {days.map((day) => {
          const dayEntries = entries.filter((entry) => entry.day === day);
          return (
            <View key={day} style={styles.dayBlock} wrap={false}>
              <Text style={styles.dayTitle}>{t(day)}</Text>
              {dayEntries.length === 0 ? (
                <Text style={styles.emptyRow}>{t("Boş")}</Text>
              ) : (
                dayEntries.map((entry, index) => (
                  <View key={index} style={styles.entryRow}>
                    <Text style={styles.entryCellTime}>{t(entry.time)}</Text>
                    <Text style={styles.entryCellSubject}>{t(entry.subject)}</Text>
                    <Text style={styles.entryCellTopic}>{t(entry.topic)}</Text>
                    <Text style={styles.entryCellTarget}>{`${entry.questionTarget} soru`}</Text>
                  </View>
                ))
              )}
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

        <View style={styles.signatureRow}>
          <Text style={styles.signatureLine}>{t("Rehber Öğretmen")}</Text>
        </View>

        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </Page>
    </Document>
  );
}
