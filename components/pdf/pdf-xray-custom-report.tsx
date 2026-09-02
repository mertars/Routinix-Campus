import { Document, Page, View, Text, Image, Svg, Circle, Polyline, Line, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";
import type { XrayRecommendation, XraySummary } from "@/lib/server/xray/recommendations";

ensurePdfFontsRegistered();

// Faz Q — "Özel PDF Oluşturucu": pdf-xray-report.tsx'in görsel dilini
// (ışık kutusu koyu tema, aynı COLORS paleti) BİLEREK AYNEN miras alır —
// bu, o raporun genişletilebilir/BLOK TABANLI bir kardeşi, farklı bir
// belge türü DEĞİL (diğer PDF'lerdeki "her belge kendi teması" kuralının
// istisnası — kullanıcı talebi: "bizim hazırladığımız şık bir şablon
// üstünde"). Route katmanı (custom-report/route.ts) her BlockSpec'i
// somut veriye (ResolvedBlock) çevirir, bu bileşen SADECE render eder.
const COLORS = {
  pageBg: "#0B1220",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  accent: "#22D3EE",
  hairline: "#1E293B",
  trackBg: "#1E293B",
  critical: "#FB7185",
  moderate: "#FBBF24",
  strong: "#34D399",
  noteBg: "#FFF8ED",
  noteBorder: "#F0DCB8",
  noteText: "#5C4632",
};

function severityColor(severity: XrayRecommendation["severity"]): string {
  if (severity === "critical") return COLORS.critical;
  if (severity === "moderate") return COLORS.moderate;
  return COLORS.strong;
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 36, fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 30, height: 30, borderRadius: 8, objectFit: "contain" },
  logoFallback: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: COLORS.accent, fontSize: 12, fontWeight: "bold" },
  institutionName: { fontSize: 9, fontWeight: "bold", color: COLORS.textMuted, marginLeft: 8, letterSpacing: 0.3 },
  titleTag: { fontSize: 12, fontWeight: "bold", color: COLORS.accent, letterSpacing: 1.4, textAlign: "right" },
  dateLabel: { fontSize: 7.5, color: COLORS.textMuted, textAlign: "right", marginTop: 2 },

  studentRow: { marginBottom: 20 },
  studentName: { fontSize: 14, fontWeight: "bold", color: COLORS.text },
  studentMeta: { fontSize: 8, color: COLORS.textMuted, marginTop: 2 },

  block: { marginBottom: 14 },
  headingText: { fontSize: 12, fontWeight: "bold", color: COLORS.accent, letterSpacing: 0.6, marginBottom: 4 },
  bodyText: { fontSize: 8.5, color: COLORS.text, lineHeight: 1.5 },

  card: { backgroundColor: "#111C33", borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, padding: 14 },
  cardLabel: { fontSize: 7.5, fontWeight: "bold", color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 8 },

  scanRow: { marginBottom: 10 },
  scanTopRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  scanName: { fontSize: 8.5, color: COLORS.text },
  scanScore: { fontSize: 8.5, fontWeight: "bold" },
  scanTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.trackBg, overflow: "hidden" },
  scanFill: { height: 6, borderRadius: 3 },

  exposureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  exposureCol: { alignItems: "center" },
  exposureLabel: { fontSize: 7, color: COLORS.textMuted, letterSpacing: 0.6, marginBottom: 4 },
  exposureDate: { fontSize: 6.5, color: COLORS.textMuted, marginBottom: 4 },
  exposureScore: { fontSize: 22, fontWeight: "bold" },
  exposureArrow: { fontSize: 16, color: COLORS.textMuted },

  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 2.5 },
  tableColDate: { width: 70, fontSize: 7.5, color: COLORS.textMuted },
  tableColName: { flex: 1, fontSize: 7.5, color: COLORS.text },
  tableColScore: { width: 40, fontSize: 7.5, fontWeight: "bold", textAlign: "right" },
  tableHeaderText: { fontSize: 6.5, color: COLORS.textMuted, letterSpacing: 0.5 },

  noteBox: { backgroundColor: COLORS.noteBg, borderWidth: 1, borderColor: COLORS.noteBorder, borderRadius: 14, padding: 14 },
  noteText: { fontSize: 8.3, color: COLORS.noteText, lineHeight: 1.4 },

  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  footerText: { fontSize: 7, color: COLORS.textMuted },
});

function t(value: string): string {
  return turkishSafe(value);
}

export type ResolvedBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "summary"; summary: XraySummary; recommendationCount: number }
  | { type: "subtopicScan"; recommendations: XrayRecommendation[] }
  | { type: "trend"; points: { assessedAt: string; average: number }[] }
  | { type: "doubleExposure"; before: { avg: number; assessedAt: string }; after: { avg: number; assessedAt: string } }
  | { type: "branchAverage"; branchName: string; branchAverage: number; studentAverage: number }
  | { type: "history"; rows: { assessedAt: string; subtopicName: string; masteryScore: number }[] };

export type PdfXrayCustomReportProps = {
  institutionName: string;
  logoUrl?: string | null;
  studentName: string;
  branchName: string;
  subject: string;
  generatedAtLabel: string;
  blocks: ResolvedBlock[];
};

// bkz. pdf-xray-report.tsx TrendChart — BİREBİR AYNI matematik, sadece
// bu belgenin kendi styles/COLORS'ına bağlı kopyası (kod tekrarı BİLİNÇLİ,
// bkz. plan dosyasındaki gerekçe).
function TrendChart({ points }: { points: { assessedAt: string; average: number }[] }) {
  const width = 400;
  const height = 46;
  const values = points.map((p) => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.average - min) / range) * (height - 10) - 5}`).join(" ");

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t("GELİŞİM EĞRİSİ")}</Text>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={0} y1={height - 5} x2={width} y2={height - 5} stroke={COLORS.trackBg} strokeWidth={1} />
        <Polyline points={coords} fill="none" stroke={COLORS.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={(i * step) as number} cy={height - ((p.average - min) / range) * (height - 10) - 5} r={2} fill={COLORS.accent} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ fontSize: 6, color: COLORS.textMuted }}>{new Date(points[0].assessedAt).toLocaleDateString("tr-TR")}</Text>
        <Text style={{ fontSize: 6, color: COLORS.textMuted }}>{new Date(points[points.length - 1].assessedAt).toLocaleDateString("tr-TR")}</Text>
      </View>
    </View>
  );
}

function scoreColor(score: number): string {
  if (score >= 60) return COLORS.strong;
  if (score >= 30) return COLORS.moderate;
  return COLORS.critical;
}

function BlockRenderer({ block }: { block: ResolvedBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <View style={styles.block}>
          <Text style={styles.headingText}>{t(block.text)}</Text>
        </View>
      );
    case "text":
      return (
        <View style={styles.block}>
          <Text style={styles.bodyText}>{t(block.text)}</Text>
        </View>
      );
    case "summary":
      return (
        <View style={[styles.block, styles.card]}>
          <Text style={styles.cardLabel}>{t("GENEL ÖZET")}</Text>
          <Text style={styles.bodyText}>{t(block.summary.overallAdvice)}</Text>
          <Text style={[styles.bodyText, { marginTop: 6, color: COLORS.textMuted }]}>
            {t(`Ortalama %${block.summary.averageScore} · ${block.recommendationCount} konu test edildi · ${block.summary.criticalCount} kritik, ${block.summary.moderateCount} orta, ${block.summary.strongCount} güçlü.`)}
          </Text>
        </View>
      );
    case "subtopicScan":
      return (
        <View style={styles.block}>
          <Text style={styles.cardLabel}>{t("KONU BAZLI TARAMA")}</Text>
          {block.recommendations.map((r) => (
            <View key={r.subtopicId} style={styles.scanRow} wrap={false}>
              <View style={styles.scanTopRow}>
                <Text style={styles.scanName}>{t(r.name)}</Text>
                <Text style={[styles.scanScore, { color: severityColor(r.severity) }]}>{`%${r.masteryScore}`}</Text>
              </View>
              <View style={styles.scanTrack}>
                <View style={[styles.scanFill, { width: `${r.masteryScore}%`, backgroundColor: severityColor(r.severity) }]} />
              </View>
            </View>
          ))}
        </View>
      );
    case "trend":
      return block.points.length >= 2 ? (
        <View style={styles.block}>
          <TrendChart points={block.points} />
        </View>
      ) : null;
    case "doubleExposure":
      return (
        <View style={[styles.block, styles.card]}>
          <Text style={styles.cardLabel}>{t("ÇİFT POZLAMA — ÖNCESİ / SONRASI")}</Text>
          <View style={styles.exposureRow}>
            <View style={styles.exposureCol}>
              <Text style={styles.exposureLabel}>{t("BAŞLANGIÇ")}</Text>
              <Text style={styles.exposureDate}>{new Date(block.before.assessedAt).toLocaleDateString("tr-TR")}</Text>
              <Text style={[styles.exposureScore, { color: scoreColor(block.before.avg) }]}>{`%${block.before.avg}`}</Text>
            </View>
            <Text style={styles.exposureArrow}>{"→"}</Text>
            <View style={styles.exposureCol}>
              <Text style={styles.exposureLabel}>{t("BUGÜN")}</Text>
              <Text style={styles.exposureDate}>{new Date(block.after.assessedAt).toLocaleDateString("tr-TR")}</Text>
              <Text style={[styles.exposureScore, { color: scoreColor(block.after.avg) }]}>{`%${block.after.avg}`}</Text>
            </View>
          </View>
        </View>
      );
    case "branchAverage": {
      const delta = block.studentAverage - block.branchAverage;
      return (
        <View style={[styles.block, styles.card]}>
          <Text style={styles.cardLabel}>{t(`ŞUBE KARŞILAŞTIRMASI — ${block.branchName}`)}</Text>
          <Text style={styles.bodyText}>
            {t(`Öğrenci ortalaması %${block.studentAverage}, şube ortalaması %${block.branchAverage} (${delta >= 0 ? "+" : ""}${delta} puan fark).`)}
          </Text>
        </View>
      );
    }
    case "history":
      return (
        <View style={styles.block}>
          <Text style={styles.cardLabel}>{t("TEST GEÇMİŞİ")}</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, styles.tableColDate]}>{t("TARİH")}</Text>
            <Text style={[styles.tableHeaderText, styles.tableColName]}>{t("KONU")}</Text>
            <Text style={[styles.tableHeaderText, styles.tableColScore]}>{t("SKOR")}</Text>
          </View>
          {block.rows.map((row, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.tableColDate}>{new Date(row.assessedAt).toLocaleDateString("tr-TR")}</Text>
              <Text style={styles.tableColName}>{t(row.subtopicName)}</Text>
              <Text style={[styles.tableColScore, { color: scoreColor(row.masteryScore) }]}>{`%${row.masteryScore}`}</Text>
            </View>
          ))}
        </View>
      );
  }
}

export function PdfXrayCustomReport({ institutionName, logoUrl, studentName, branchName, subject, generatedAtLabel, blocks }: PdfXrayCustomReportProps) {
  return (
    <Document title={t(`${studentName} - Ozel Rontgen Raporu`)}>
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
            <Text style={styles.titleTag}>{t("AKADEMİK RÖNTGEN")}</Text>
            <Text style={styles.dateLabel}>{t(generatedAtLabel)}</Text>
          </View>
        </View>

        <View style={styles.studentRow}>
          <Text style={styles.studentName}>{t(studentName)}</Text>
          <Text style={styles.studentMeta}>{t(`${branchName} · ${subject}`)}</Text>
        </View>

        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("Bu rapor bir tanı testi sonucudur, kesin bir değerlendirme yerine geçmez.")}</Text>
          <Text style={styles.footerText}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
