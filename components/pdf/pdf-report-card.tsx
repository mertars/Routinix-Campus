import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe, turkishSafeOrNull } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Uygulamanın gerçek Tailwind tema renkleriyle BİREBİR aynı hex değerleri
// (bkz. tailwind.config.ts > cream/espresso/hairline, app/globals.css >
// --brand-600 varsayılanı) — PDF, uygulamanın geri kalanıyla aynı kurumsal
// kimliği taşısın diye ayrı bir renk paleti İCAT EDİLMEDİ.
const COLORS = {
  pageBg: "#FDFBF7", // cream
  cardBg: "#F5F2EB", // cream-muted
  cardBgAlt: "#FAFAF7", // cream-card
  text: "#2C221E", // espresso
  textMuted: "#786C66", // espresso-muted
  accent: "#FF6B00", // brand-600 (varsayılan kurum vurgu rengi)
  accentDark: "#B34B00", // brand-800
  hairline: "#E6E1D5",
  positive: "#15803D",
  negative: "#B91C1C",
  commentBg: "#FDF6EC",
  commentBorder: "#F0DCB8",
  commentTitle: "#92450E",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    backgroundColor: COLORS.pageBg,
    color: COLORS.text,
    padding: 42,
    fontSize: 10.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.accent,
    paddingBottom: 14,
    marginBottom: 18,
  },
  logoImage: { width: 40, height: 40, borderRadius: 8, objectFit: "contain" },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: { color: COLORS.pageBg, fontSize: 18, fontWeight: "bold" },
  institutionName: { fontSize: 17, fontWeight: "bold", letterSpacing: -0.2 },
  subtitle: { fontSize: 9, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1.5, marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { color: COLORS.textMuted },
  metaValue: { fontWeight: "bold" },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "bold" },
  statLabel: { fontSize: 7.5, color: COLORS.textMuted, letterSpacing: 0.8, marginTop: 3 },
  table: { marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.text, borderRadius: 4 },
  tableHeaderCell: { color: COLORS.pageBg, fontSize: 9, fontWeight: "bold", padding: 7, flex: 1 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  tableCell: { fontSize: 9.5, padding: 7, flex: 1 },
  deltaPositive: { color: COLORS.positive, fontWeight: "bold" },
  deltaNegative: { color: COLORS.negative, fontWeight: "bold" },
  guidanceBox: { backgroundColor: COLORS.cardBgAlt, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 10, padding: 14 },
  guidanceTitle: { fontSize: 9, fontWeight: "bold", color: "#5C3D2E", letterSpacing: 0.8, marginBottom: 8 },
  guidanceItem: { fontSize: 9.5, lineHeight: 1.4, marginBottom: 5 },
  commentBox: { backgroundColor: COLORS.commentBg, borderWidth: 1, borderColor: COLORS.commentBorder, borderRadius: 10, padding: 14, marginTop: 12 },
  commentTitle: { fontSize: 9, fontWeight: "bold", color: COLORS.commentTitle, letterSpacing: 0.8, marginBottom: 6 },
  commentText: { fontSize: 9.5, lineHeight: 1.5 },
  watermark: { position: "absolute", bottom: 24, right: 42, fontSize: 7, color: COLORS.textMuted, opacity: 0.55 },
});

export type SubjectRow = { subject: string; studentNet: number; classAverageNet: number; delta: number };

export type PdfReportCardProps = {
  institutionName: string;
  logoUrl?: string | null;
  studentName: string;
  branchName: string;
  periodLabel: string;
  attendanceRate: number;
  subjectSummaries: SubjectRow[];
  guidanceNotes: string[];
  teacherComment?: string | null;
};

// Kampüs V2 Part 5 — Gelişim Karnesi PDF şablonu. A4, tek sayfa, taşma
// olmadan (flex tabanlı satırlar + StyleSheet boyutları A4'ün 595x842pt
// alanına göre ayarlandı). Institution.logoUrl varsa sol üstte gösterilir,
// yoksa kurum adının baş harfiyle bir monogram kutusuna düşer (bkz.
// logoFallback) — eski Handlebars şablonundaki AYNI görsel yedek deseni.
//
// t(): TÜM metin (sabit etiketler DAHİL) turkishSafe()'ten geçirilir —
// bkz. lib/server/pdf/turkish-text.ts'teki react-pdf "ı" kusuru notu.
// Sadece "ı" karakteri etkilenir (ğ/ş/ç/ö/ü ve büyük halleri SORUNSUZ
// render edilir), bu yüzden etiketler normal, doğru Türkçe yazılabilir.
function t(value: string): string {
  return turkishSafe(value);
}

export function PdfReportCard({
  institutionName,
  logoUrl,
  studentName,
  branchName,
  periodLabel,
  attendanceRate,
  subjectSummaries,
  guidanceNotes,
  teacherComment,
}: PdfReportCardProps) {
  const safeTeacherComment = turkishSafeOrNull(teacherComment ?? null);

  return (
    <Document title={t(`${studentName} - Gelişim Karnesi`)}>
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
            <Text style={styles.subtitle}>{t("GELİŞİM KARNESİ")}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>{t("Öğrenci: ")}</Text>
            <Text style={styles.metaValue}>{t(studentName)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Şube: ")}</Text>
            <Text style={styles.metaValue}>{t(branchName)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Dönem: ")}</Text>
            <Text style={styles.metaValue}>{t(periodLabel)}</Text>
          </Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            {/* Tek bir string'e birleştirilmiş template literal İLE yazılır — react-pdf'in
                "%" + ayrı bir ifade çocuğu (örn. %{'{'}deger{'}'}) birleşiminde "%" karakterini
                bozan (tofu/notdef) AYRI bir doğrulanmış hatasından kaçınmak için (bkz. PART 5
                araştırma notları) — bkz. turkishSafe'in ele aldığı "ı" hatasından FARKLI bir kusur. */}
            <Text style={styles.statValue}>{`%${attendanceRate}`}</Text>
            <Text style={styles.statLabel}>{t("DEVAM ORANI")}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{subjectSummaries.length}</Text>
            <Text style={styles.statLabel}>{t("DEĞERLENDİRİLEN BRANŞ")}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderCell}>{t("Branş")}</Text>
            <Text style={styles.tableHeaderCell}>{t("Öğrenci Neti")}</Text>
            <Text style={styles.tableHeaderCell}>{t("Sınıf Ortalaması")}</Text>
            <Text style={styles.tableHeaderCell}>{t("Fark")}</Text>
          </View>
          {subjectSummaries.map((row) => (
            <View key={row.subject} style={styles.tableRow}>
              <Text style={styles.tableCell}>{t(row.subject)}</Text>
              <Text style={styles.tableCell}>{row.studentNet}</Text>
              <Text style={styles.tableCell}>{row.classAverageNet}</Text>
              <Text style={[styles.tableCell, row.delta >= 0 ? styles.deltaPositive : styles.deltaNegative]}>
                {`${row.delta >= 0 ? "+" : ""}${row.delta}`}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceTitle}>{t("OTOMATİK REHBERLİK DEĞERLENDİRMESİ")}</Text>
          {guidanceNotes.map((note, index) => (
            <Text key={index} style={styles.guidanceItem}>
              {`• ${t(note)}`}
            </Text>
          ))}
        </View>

        {safeTeacherComment && (
          <View style={styles.commentBox}>
            <Text style={styles.commentTitle}>{t("DANIŞMAN ÖĞRETMEN YORUMU")}</Text>
            <Text style={styles.commentText}>{safeTeacherComment}</Text>
          </View>
        )}

        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </Page>
    </Document>
  );
}
