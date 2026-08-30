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
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  metaLabel: { color: COLORS.textMuted },
  metaValue: { fontWeight: "bold" },
  entryCard: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, padding: 40, gap: 14 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.pageBg, fontSize: 32, fontWeight: "bold" },
  studentName: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  studentBranch: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginTop: 2 },
  seatBadge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.accent, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20 },
  seatBadgeLabel: { color: "#FFFFFF", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 },
  seatBadgeValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  entryNote: { maxWidth: 320, textAlign: "center", fontSize: 8.5, color: COLORS.textMuted, lineHeight: 1.4 },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.text, borderRadius: 4 },
  tableHeaderCell: { color: COLORS.pageBg, fontSize: 9, fontWeight: "bold", padding: 7 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  tableCell: { fontSize: 9, padding: 7 },
  colSeat: { width: 70 },
  colStudent: { flex: 1 },
  colBranch: { width: 140 },
  watermark: { position: "absolute", bottom: 24, right: 42, fontSize: 7, color: COLORS.textMuted, opacity: 0.55 },
});

export type PdfExamSeat = { seatNumber: number; studentName: string; branchName: string };

export type PdfExamDocumentProps = {
  institutionName: string;
  logoUrl?: string | null;
  mode: "entry" | "doorList";
  hall: string;
  examName: string;
  examDate: string;
  seat?: PdfExamSeat;
  seats?: PdfExamSeat[];
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 — Sınav Giriş Belgesi (tekil öğrenci) / Salon Kapı Listesi
// (tüm koltuklar) — eski window.print() tabanlı önizlemenin (artık silindi)
// yerini alır, bkz. components/pdf/pdf-report-card.tsx'teki AYNI mimari
// gerekçe notu.
export function PdfExamDocument({ institutionName, logoUrl, mode, hall, examName, examDate, seat, seats }: PdfExamDocumentProps) {
  return (
    <Document title={t(mode === "entry" ? "Sinav Giris Belgesi" : "Salon Kapi Listesi")}>
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
            <Text style={styles.subtitle}>{t(mode === "entry" ? "SINAV GİRİŞ BELGESİ" : "SALON KAPI LİSTESİ")}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>{t("Sınav: ")}</Text>
            <Text style={styles.metaValue}>{t(examName)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Tarih: ")}</Text>
            <Text style={styles.metaValue}>{t(examDate)}</Text>
          </Text>
          <Text>
            <Text style={styles.metaLabel}>{t("Salon: ")}</Text>
            <Text style={styles.metaValue}>{t(hall)}</Text>
          </Text>
        </View>

        {mode === "entry" && seat ? (
          <View style={styles.entryCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{t(seat.studentName).charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.studentName}>{t(seat.studentName)}</Text>
              <Text style={styles.studentBranch}>{t(seat.branchName)}</Text>
            </View>
            <View style={styles.seatBadge}>
              <Text style={styles.seatBadgeLabel}>{t("Koltuk No")}</Text>
              <Text style={styles.seatBadgeValue}>{String(seat.seatNumber)}</Text>
            </View>
            <Text style={styles.entryNote}>
              {t("Sınav saatinden 30 dakika önce salonda hazır bulununuz. Bu belge ve kimlik kartınız salon girişinde kontrol edilecektir.")}
            </Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colSeat]}>{t("Koltuk No")}</Text>
              <Text style={[styles.tableHeaderCell, styles.colStudent]}>{t("Öğrenci")}</Text>
              <Text style={[styles.tableHeaderCell, styles.colBranch]}>{t("Şube")}</Text>
            </View>
            {(seats ?? []).map((row) => (
              <View key={row.seatNumber} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colSeat]}>{String(row.seatNumber)}</Text>
                <Text style={[styles.tableCell, styles.colStudent]}>{t(row.studentName)}</Text>
                <Text style={[styles.tableCell, styles.colBranch]}>{t(row.branchName)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </Page>
    </Document>
  );
}
