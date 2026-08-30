import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

const COLORS = {
  pageBg: "#FDFBF7",
  text: "#2C221E",
  textMuted: "#786C66",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#E6E1D5",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 42, fontSize: 9.5 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 3, borderBottomColor: COLORS.accent, paddingBottom: 14, marginBottom: 18 },
  logoImage: { width: 40, height: 40, borderRadius: 8, objectFit: "contain" },
  logoFallback: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: COLORS.pageBg, fontSize: 18, fontWeight: "bold" },
  institutionName: { fontSize: 16, fontWeight: "bold", letterSpacing: -0.2 },
  subtitle: { fontSize: 9, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1.2, marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { color: COLORS.textMuted },
  metaValue: { fontWeight: "bold" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.text, borderRadius: 4 },
  tableHeaderCell: { color: COLORS.pageBg, fontSize: 9, fontWeight: "bold", padding: 7 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  tableCell: { fontSize: 9, padding: 7 },
  colDay: { width: 90, fontWeight: "bold" },
  colSlot: { width: 110 },
  colBranch: { flex: 1 },
  emptyCell: { color: COLORS.textMuted },
  watermark: { position: "absolute", bottom: 24, right: 42, fontSize: 7, color: COLORS.textMuted, opacity: 0.55 },
});

export type PdfScheduleRow = { day: string; slot: string; branchName: string };

export type PdfTeacherScheduleProps = {
  institutionName: string;
  logoUrl?: string | null;
  teacherName: string;
  subject: string;
  days: readonly string[];
  schedule: PdfScheduleRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 — Haftalık Ders Programı (bkz. teacher-schedule-print-modal.tsx,
// artık silindi) — bkz. components/pdf/pdf-report-card.tsx'teki AYNI
// mimari gerekçe notu.
export function PdfTeacherSchedule({ institutionName, logoUrl, teacherName, subject, days, schedule }: PdfTeacherScheduleProps) {
  return (
    <Document title={t(`${teacherName} - Haftalik Ders Programi`)}>
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
            <Text style={styles.subtitle}>{t("HAFTALIK DERS PROGRAMI")}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>{t("Öğretmen: ")}</Text>
            <Text style={styles.metaValue}>{t(teacherName)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Branş: ")}</Text>
            <Text style={styles.metaValue}>{t(subject)}</Text>
          </Text>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, styles.colDay]}>{t("Gün")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colSlot]}>{t("Saat")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colBranch]}>{t("Sınıf")}</Text>
        </View>
        {days.map((day) => {
          const dayRows = schedule.filter((row) => row.day === day);
          if (dayRows.length === 0) {
            return (
              <View key={day} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDay]}>{t(day)}</Text>
                <Text style={[styles.tableCell, styles.emptyCell, { flex: 1 }]}>{t("Boş")}</Text>
              </View>
            );
          }
          return dayRows.map((row, index) => (
            <View key={`${day}-${index}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDay]}>{index === 0 ? t(day) : ""}</Text>
              <Text style={[styles.tableCell, styles.colSlot]}>{row.slot}</Text>
              <Text style={[styles.tableCell, styles.colBranch]}>{t(row.branchName)}</Text>
            </View>
          ));
        })}

        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </Page>
    </Document>
  );
}
