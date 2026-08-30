import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Faz Q — "Veli toplantısı raporu": tek öğrencilik pdf-xray-report.tsx'in
// (bkz. o dosyadaki radyoloji filmi teması) AKSİNE, bir ŞUBENİN TAMAMI
// için TEK bir PDF'te TARANABİLİR bir tablo — 30 öğrenci için 30 sayfa
// çevirmek yerine, öğretmenin/velinin toplantıda hızlıca "hangi öğrenci
// hangi konuda zayıf" görebileceği kompakt bir liste. Bu yüzden BİLEREK
// ring-chart/reçete gibi tek-öğrenci-özel detaylar YOK — sadece özet.
const COLORS = {
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#0284C7",
  hairline: "#E2DCD0",
  headerBg: "#0B1220",
  headerText: "#F1F5F9",
  rowAlt: "#FAF8F4",
  critical: "#E11D48",
  moderate: "#D97706",
  strong: "#059669",
};

function scoreColor(score: number | null): string {
  if (score === null) return COLORS.textMuted;
  if (score >= 60) return COLORS.strong;
  if (score >= 30) return COLORS.moderate;
  return COLORS.critical;
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, padding: 32, fontSize: 8.5 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 28, height: 28, borderRadius: 8, objectFit: "contain" },
  logoFallback: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold" },
  institutionName: { fontSize: 9, fontWeight: "bold", color: COLORS.textMuted, marginLeft: 8 },
  titleTag: { fontSize: 12, fontWeight: "bold", color: COLORS.accent, textAlign: "right" },
  dateLabel: { fontSize: 7.5, color: COLORS.textMuted, textAlign: "right", marginTop: 2 },

  subtitleRow: { marginTop: 12, marginBottom: 14 },
  subtitle: { fontSize: 13, fontWeight: "bold", color: COLORS.text },
  subtitleMeta: { fontSize: 8, color: COLORS.textMuted, marginTop: 2 },

  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 8, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headerBg, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { fontSize: 7, fontWeight: "bold", color: COLORS.headerText, letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  cellName: { width: "24%", fontSize: 8, fontWeight: "bold", color: COLORS.text },
  cellAvg: { width: "12%", fontSize: 8, fontWeight: "bold" },
  cellTested: { width: "14%", fontSize: 7.5, color: COLORS.textMuted },
  cellRedZone: { width: "12%", fontSize: 7.5, fontWeight: "bold" },
  cellWeakest: { width: "38%", fontSize: 7.5, color: COLORS.textMuted },

  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  footerText: { fontSize: 7, color: COLORS.textMuted },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.7 },
});

export type PdfBranchReportRow = {
  studentName: string;
  averageScore: number | null;
  testedCount: number;
  totalCount: number;
  redZoneCount: number;
  weakestSubtopicName: string | null;
};

export type PdfXrayBranchReportProps = {
  institutionName: string;
  logoUrl?: string | null;
  branchName: string;
  subject: string;
  generatedAtLabel: string;
  rows: PdfBranchReportRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

export function PdfXrayBranchReport({ institutionName, logoUrl, branchName, subject, generatedAtLabel, rows }: PdfXrayBranchReportProps) {
  const sorted = [...rows].sort((a, b) => (a.averageScore ?? 999) - (b.averageScore ?? 999));

  return (
    <Document title={t(`${branchName} - Veli Toplantisi Raporu`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
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
          <View>
            <Text style={styles.titleTag}>{t("VELİ TOPLANTISI RAPORU")}</Text>
            <Text style={styles.dateLabel}>{t(generatedAtLabel)}</Text>
          </View>
        </View>

        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{t(`${branchName} — ${subject}`)}</Text>
          <Text style={styles.subtitleMeta}>{t(`${rows.length} öğrenci — en düşük ortalamadan yükseğe sıralı`)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "24%" }]}>{t("ÖĞRENCİ")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>{t("ORTALAMA")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>{t("TEST EDİLEN")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>{t("KIRMIZI")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "38%" }]}>{t("EN ZAYIF KONU")}</Text>
          </View>
          {sorted.map((row, i) => (
            <View key={row.studentName + i} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.rowAlt } : undefined]} wrap={false}>
              <Text style={styles.cellName}>{t(row.studentName)}</Text>
              <Text style={[styles.cellAvg, { color: scoreColor(row.averageScore) }]}>{row.averageScore === null ? "—" : `%${row.averageScore}`}</Text>
              <Text style={styles.cellTested}>{`${row.testedCount}/${row.totalCount}`}</Text>
              <Text style={[styles.cellRedZone, { color: row.redZoneCount > 0 ? COLORS.critical : COLORS.textMuted }]}>{String(row.redZoneCount)}</Text>
              <Text style={styles.cellWeakest}>{row.weakestSubtopicName ? t(row.weakestSubtopicName) : t("—")}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("Bu rapor bir tanı testi sonucudur, kesin bir değerlendirme yerine geçmez.")}</Text>
          <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
