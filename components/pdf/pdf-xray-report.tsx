import { Document, Page, View, Text, Image, Svg, Circle, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";
import type { XrayRecommendation, XraySummary } from "@/lib/server/xray/recommendations";

ensurePdfFontsRegistered();

// bkz. pdf-report-card.tsx (sertifika), pdf-exam-document.tsx (bilet/
// manifesto), pdf-guidance-program.tsx (kişisel günlük), pdf-teacher-
// schedule.tsx/pdf-yearly-plan.tsx (masa referansı), pdf-credentials-list.tsx
// (güvenlik belgesi) — ALTINCI, en radikal farklı dil: bu belgenin adı
// zaten "RÖNTGEN", bu yüzden tasarım BİLEREK gerçek bir radyoloji filmi
// ışık kutusunu taklit ediyor — koyu lacivert/siyah zemin + camgöbeği
// parlayan tarama çubukları. Sayfanın alt yarısındaki "REÇETE" kartı
// BİLEREK zıt (sıcak/krem) — teşhis (soğuk/klinik) ile reçete (sıcak/
// insani) arasında görsel bir anlatı kuruyor.
const COLORS = {
  pageBg: "#0B1220",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  accent: "#22D3EE",
  accentDim: "#0E7490",
  hairline: "#1E293B",
  trackBg: "#1E293B",
  critical: "#FB7185",
  moderate: "#FBBF24",
  strong: "#34D399",
  prescriptionBg: "#FFF8ED",
  prescriptionBorder: "#F0DCB8",
  prescriptionText: "#5C4632",
};

function severityColor(severity: XrayRecommendation["severity"]): string {
  if (severity === "critical") return COLORS.critical;
  if (severity === "moderate") return COLORS.moderate;
  return COLORS.strong;
}

function severityLabel(severity: XrayRecommendation["severity"]): string {
  if (severity === "critical") return "KRİTİK";
  if (severity === "moderate") return "ORTA";
  return "İYİ";
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

  patientCard: {
    flexDirection: "row",
    backgroundColor: "#111C33",
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: "center",
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 14, fontWeight: "bold", color: COLORS.text },
  patientMeta: { fontSize: 8, color: COLORS.textMuted, marginTop: 2 },
  patientRow: { flexDirection: "row", marginTop: 8, gap: 18 },
  patientLabel: { fontSize: 6.5, color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 1 },
  patientValue: { fontSize: 9, fontWeight: "bold", color: COLORS.text },

  ringWrap: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  ringValueWrap: { position: "absolute", alignItems: "center" },
  ringValue: { fontSize: 20, fontWeight: "bold", color: COLORS.accent },
  ringLabel: { fontSize: 6, color: COLORS.textMuted, letterSpacing: 0.6, marginTop: 1 },

  sectionLabel: { fontSize: 8.5, fontWeight: "bold", color: COLORS.accent, letterSpacing: 1.2, marginBottom: 10 },

  scanRow: { marginBottom: 10 },
  scanTopRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  scanName: { fontSize: 8.5, color: COLORS.text },
  scanScore: { fontSize: 8.5, fontWeight: "bold" },
  scanTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.trackBg, overflow: "hidden" },
  scanFill: { height: 6, borderRadius: 3 },

  prescriptionBox: { backgroundColor: COLORS.prescriptionBg, borderWidth: 1, borderColor: COLORS.prescriptionBorder, borderRadius: 14, padding: 14, marginTop: 16 },
  prescriptionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  prescriptionTitle: { fontSize: 9, fontWeight: "bold", color: "#B34B00", letterSpacing: 1 },
  prescriptionSummary: { fontSize: 8.3, color: COLORS.prescriptionText, lineHeight: 1.4, marginBottom: 10 },
  prescriptionRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 7 },
  prescriptionDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 2 },
  prescriptionText: { flex: 1, fontSize: 8.2, color: COLORS.prescriptionText, lineHeight: 1.35 },
  prescriptionSubtopicName: { fontWeight: "bold" },

  emptyState: { padding: 30, alignItems: "center" },
  emptyStateText: { fontSize: 9, color: COLORS.textMuted },

  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  footerText: { fontSize: 7, color: COLORS.textMuted },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.7 },
});

export type PdfXrayReportProps = {
  institutionName: string;
  logoUrl?: string | null;
  studentName: string;
  branchName: string;
  subject: string;
  generatedAtLabel: string;
  recommendations: XrayRecommendation[];
  summary: XraySummary;
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kural bazlı reçete (bkz. lib/server/xray/recommendations.ts) BURADA
// TEKRAR hesaplanmaz — route katmanından hazır gelir, bu bileşen sadece
// render eder (bkz. diğer PDF bileşenlerindeki aynı "component dumb, route
// smart" ayrımı).
export function PdfXrayReport({ institutionName, logoUrl, studentName, branchName, subject, generatedAtLabel, recommendations, summary }: PdfXrayReportProps) {
  const ringSize = 84;
  const ringCenter = ringSize / 2;
  const ringRadius = ringCenter - 8;
  const ringCircumference = 2 * Math.PI * ringRadius;
  // Math.max(0.01, ...) — react-pdf'in SVG dash render'ı tam 0 uzunluklu bir
  // segmenti reddediyor ("lengths must be numeric and greater than zero");
  // henüz hiç konu test edilmemişken (averageScore=0) bu satır patlıyordu.
  const ringArc = Math.max(0.01, ringCircumference * (summary.averageScore / 100));

  const sorted = [...recommendations].sort((a, b) => a.masteryScore - b.masteryScore);

  return (
    <Document title={t(`${studentName} - Akademik Rontgen Raporu`)}>
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

        <View style={styles.patientCard}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{t(studentName)}</Text>
            <Text style={styles.patientMeta}>{t(branchName)}</Text>
            <View style={styles.patientRow}>
              <View>
                <Text style={styles.patientLabel}>{t("TETKİK")}</Text>
                <Text style={styles.patientValue}>{t(subject)}</Text>
              </View>
              <View>
                <Text style={styles.patientLabel}>{t("TEST EDİLEN KONU")}</Text>
                <Text style={styles.patientValue}>{String(recommendations.length)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.ringWrap}>
            <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <Circle cx={ringCenter} cy={ringCenter} r={ringRadius} stroke={COLORS.trackBg} strokeWidth={8} fill="none" />
              <Circle
                cx={ringCenter}
                cy={ringCenter}
                r={ringRadius}
                stroke={COLORS.accent}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ringArc}, ${ringCircumference}`}
                transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
              />
            </Svg>
            <View style={styles.ringValueWrap}>
              <Text style={styles.ringValue}>{`%${summary.averageScore}`}</Text>
              <Text style={styles.ringLabel}>{t("GENEL")}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t("KONU BAZLI TARAMA")}</Text>

        {recommendations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("Bu ders için henüz röntgen testi tamamlanmadı.")}</Text>
          </View>
        ) : (
          sorted.map((r) => (
            <View key={r.subtopicId} style={styles.scanRow} wrap={false}>
              <View style={styles.scanTopRow}>
                <Text style={styles.scanName}>{t(r.name)}</Text>
                <Text style={[styles.scanScore, { color: severityColor(r.severity) }]}>{`%${r.masteryScore}`}</Text>
              </View>
              <View style={styles.scanTrack}>
                <View style={[styles.scanFill, { width: `${r.masteryScore}%`, backgroundColor: severityColor(r.severity) }]} />
              </View>
            </View>
          ))
        )}

        <View style={styles.prescriptionBox}>
          <View style={styles.prescriptionHeader}>
            <Text style={styles.prescriptionTitle}>{t("REÇETE")}</Text>
          </View>
          <Text style={styles.prescriptionSummary}>{t(summary.overallAdvice)}</Text>
          {sorted.slice(0, 5).map((r) => (
            <View key={r.subtopicId} style={styles.prescriptionRow}>
              <View style={[styles.prescriptionDot, { backgroundColor: severityColor(r.severity) }]} />
              <Text style={styles.prescriptionText}>
                <Text style={styles.prescriptionSubtopicName}>{t(`${r.name} (${severityLabel(r.severity)}) `)}</Text>
                {t(r.advice)}
              </Text>
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
