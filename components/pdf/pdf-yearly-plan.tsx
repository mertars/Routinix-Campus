import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. pdf-teacher-schedule.tsx'teki AYNI "öğretmen masası referansı"
// gerekçesi — sade/fonksiyonel ama düz değil: numaralı hafta rozetleri +
// ince ilerleme çubuğu ile bir "planlayıcı defteri" hissi.
const COLORS = {
  pageBg: "#FFFFFF",
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#E2DCD0",
  rowAlt: "#FAF8F4",
  headBg: "#2C221E",
  trackBg: "#F0EBE1",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 36, fontSize: 9 },

  topAccent: { height: 4, backgroundColor: COLORS.accent, borderRadius: 2, marginBottom: 18 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 34, height: 34, borderRadius: 9, objectFit: "contain" },
  logoFallback: { width: 34, height: 34, borderRadius: 9, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  teacherName: { fontSize: 16, fontWeight: "bold", marginLeft: 10 },
  subjectLabel: { fontSize: 9, color: COLORS.textMuted, marginLeft: 10, marginTop: 1 },
  titleTag: { fontSize: 8.5, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1.4, textAlign: "right" },
  institutionNameSmall: { fontSize: 8, color: COLORS.textMuted, textAlign: "right", marginTop: 2 },

  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.trackBg, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: COLORS.accent, borderRadius: 3 },
  progressLabel: { fontSize: 8, fontWeight: "bold", color: COLORS.textMuted, width: 92, textAlign: "right" },

  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: COLORS.text, paddingBottom: 6, marginBottom: 2 },
  tableHeaderCell: { fontSize: 7.5, fontWeight: "bold", color: COLORS.textMuted, letterSpacing: 0.6 },
  colWeek: { width: 56 },
  colTopic: { flex: 1.3 },
  colNote: { flex: 1, color: COLORS.textMuted },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  rowAlt: { backgroundColor: COLORS.rowAlt },
  weekBadge: { width: 34, height: 20, borderRadius: 10, backgroundColor: "#FFF1E4", alignItems: "center", justifyContent: "center", marginRight: 12 },
  weekBadgeText: { fontSize: 8, fontWeight: "bold", color: COLORS.accentDark },
  topicText: { flex: 1.3, fontSize: 9, fontWeight: "bold" },
  noteText: { flex: 1, fontSize: 8.5, color: COLORS.textMuted },

  emptyState: { padding: 40, alignItems: "center" },
  emptyStateText: { fontSize: 9, color: COLORS.textMuted },

  watermarkRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },
});

export type PdfYearlyPlanRow = { weekLabel: string; subtopicName: string; notes: string };

export type PdfYearlyPlanProps = {
  institutionName: string;
  logoUrl?: string | null;
  teacherName: string;
  subject: string;
  rows: PdfYearlyPlanRow[];
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 — Özelleştirilmiş Yıllık Plan: öğretmenin kendi masa referansı.
// Haftalar sıralı bir "planlayıcı defteri" listesi olarak gösterilir —
// numaralı rozet (hafta sırası, GİRİLDİĞİ sıra — takvim haftası değil)
// + kalın konu başlığı + soluk not. Üstte basit bir "kaç hafta girildi"
// ilerleme çubuğu (25 haftalık tipik bir dönem varsayımıyla, sadece
// görsel bir gösterge — kesin bir müfredat hedefi DEĞİL).
const ASSUMED_TERM_WEEKS = 25;

export function PdfYearlyPlan({ institutionName, logoUrl, teacherName, subject, rows }: PdfYearlyPlanProps) {
  const progress = Math.max(0, Math.min(1, rows.length / ASSUMED_TERM_WEEKS));

  return (
    <Document title={t(`${teacherName} - Yillik Plan`)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
              <Image src={logoUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>{t(teacherName).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.teacherName}>{t(teacherName)}</Text>
              <Text style={styles.subjectLabel}>{t(subject)}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.titleTag}>{t("YILLIK PLAN")}</Text>
            <Text style={styles.institutionNameSmall}>{t(institutionName)}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{t(`${rows.length} hafta girildi`)}</Text>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("Henüz plan satırı eklenmedi.")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colWeek]}>{t("HAFTA")}</Text>
              <Text style={[styles.tableHeaderCell, styles.colTopic]}>{t("KAZANIM / ALT KONU")}</Text>
              <Text style={[styles.tableHeaderCell, styles.colNote]}>{t("NOT")}</Text>
            </View>
            {rows.map((row, index) => (
              <View key={index} style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]} wrap={false}>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>{t(row.weekLabel)}</Text>
                </View>
                <Text style={styles.topicText}>{t(row.subtopicName)}</Text>
                <Text style={styles.noteText}>{t(row.notes || "—")}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.watermarkRow}>
          <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
