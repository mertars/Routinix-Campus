import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Kullanıcı talebi (2026-09-03) — "Genel Bakış" ekranının (kurum/sınıf
// seviyesi/şube drill-down) her katmanında PDF indirilebilmeli. Bu,
// pdf-xray-branch-report.tsx'in (bkz. o dosyanın "veli toplantısı"
// tasarım gerekçesi) AYNI tablo dilini kullanan, ama satırları ÖĞRENCİ
// değil SINIF SEVİYESİ ya da ŞUBE olan genel bir sürümü — Genel Bakış
// panelinin ZATEN hesapladığı (lib/server/xray/institution-overview.ts)
// aynı sayılar, sadece yazdırılabilir hale getiriliyor.
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

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 8, padding: 8 },
  summaryLabel: { fontSize: 6.5, color: COLORS.textMuted, letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, fontWeight: "bold", marginTop: 2 },

  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 8, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headerBg, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { fontSize: 7, fontWeight: "bold", color: COLORS.headerText, letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  cellName: { width: "40%", fontSize: 8, fontWeight: "bold", color: COLORS.text },
  cellAvg: { width: "20%", fontSize: 8, fontWeight: "bold" },
  cellTested: { width: "20%", fontSize: 7.5, color: COLORS.textMuted },
  cellRedZone: { width: "20%", fontSize: 7.5, fontWeight: "bold" },

  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  footerText: { fontSize: 7, color: COLORS.textMuted },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.7 },
});

export type PdfScopeReportRow = { label: string; studentCount: number; testedCount: number; average: number | null; redZoneCount: number };

export type PdfXrayScopeReportProps = {
  institutionName: string;
  logoUrl?: string | null;
  scopeTitle: string; // "Kurum Geneli" | "11. Sınıf"
  subject: string;
  rowLabelHeader: string; // "SINIF SEVİYESİ" | "ŞUBE"
  generatedAtLabel: string;
  summary: { average: number | null; studentCount: number; testedCount: number; redZoneCount: number };
  rows: PdfScopeReportRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

export function PdfXrayScopeReport({ institutionName, logoUrl, scopeTitle, subject, rowLabelHeader, generatedAtLabel, summary, rows }: PdfXrayScopeReportProps) {
  const sorted = [...rows].sort((a, b) => (a.average ?? 999) - (b.average ?? 999));

  return (
    <Document title={t(`${scopeTitle} - Genel Bakis Raporu`)}>
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
            <Text style={styles.titleTag}>{t("GENEL BAKIŞ RAPORU")}</Text>
            <Text style={styles.dateLabel}>{t(generatedAtLabel)}</Text>
          </View>
        </View>

        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{t(`${scopeTitle} — ${subject}`)}</Text>
          <Text style={styles.subtitleMeta}>{t(`${rows.length} kayıt — en düşük ortalamadan yükseğe sıralı`)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("ORTALAMA")}</Text>
            <Text style={[styles.summaryValue, { color: scoreColor(summary.average) }]}>{summary.average === null ? "—" : `%${summary.average}`}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("TEST EDİLEN ÖĞRENCİ")}</Text>
            <Text style={styles.summaryValue}>{`${summary.testedCount}/${summary.studentCount}`}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("KIRMIZI BÖLGE")}</Text>
            <Text style={[styles.summaryValue, { color: summary.redZoneCount > 0 ? COLORS.critical : COLORS.text }]}>{String(summary.redZoneCount)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "40%" }]}>{t(rowLabelHeader)}</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%" }]}>{t("ORTALAMA")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%" }]}>{t("TEST EDİLEN")}</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%" }]}>{t("KIRMIZI")}</Text>
          </View>
          {sorted.map((row, i) => (
            <View key={row.label + i} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.rowAlt } : undefined]} wrap={false}>
              <Text style={styles.cellName}>{t(row.label)}</Text>
              <Text style={[styles.cellAvg, { color: scoreColor(row.average) }]}>{row.average === null ? "—" : `%${row.average}`}</Text>
              <Text style={styles.cellTested}>{`${row.testedCount}/${row.studentCount}`}</Text>
              <Text style={[styles.cellRedZone, { color: row.redZoneCount > 0 ? COLORS.critical : COLORS.textMuted }]}>{String(row.redZoneCount)}</Text>
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
