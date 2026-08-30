import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. pdf-report-card.tsx (sertifika), pdf-exam-document.tsx (bilet/
// manifesto), pdf-guidance-program.tsx (kişisel günlük), pdf-teacher-
// schedule.tsx / pdf-yearly-plan.tsx (masa referansı) — BEŞİNCİ, bilinçli
// olarak farklı bir dil: bu belge öğrenciye/veliye değil, hesapları
// oluşturan YÖNETİCİYE gidiyor ve TEK SEFERLİK geçici şifreler içeriyor.
// Sıcak/turuncu "kurumsal" hissiyat yerine soğuk gri + kırmızı uyarı
// paleti ve "terminal" görünümlü koyu şifre çipleri kullanılır — belgenin
// diğerlerinden FARKLI, hassas bir güvenlik dokümanı olduğu ilk bakışta
// anlaşılsın diye.
const COLORS = {
  pageBg: "#FFFFFF",
  text: "#1F2937",
  textMuted: "#6B7280",
  accent: "#FF6B00",
  headBg: "#1F2937",
  hairline: "#E5E7EB",
  rowAlt: "#F9FAFB",
  warningBg: "#FEF2F2",
  warningBorder: "#FCA5A5",
  warningText: "#B91C1C",
  chipBg: "#111827",
  chipText: "#F9FAFB",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 36, fontSize: 9 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 32, height: 32, borderRadius: 9, objectFit: "contain" },
  logoFallback: { width: 32, height: 32, borderRadius: 9, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  institutionName: { fontSize: 13, fontWeight: "bold", marginLeft: 10 },
  subtitle: { fontSize: 8.5, color: COLORS.textMuted, marginLeft: 10, marginTop: 1 },
  titleTag: { fontSize: 8.5, fontWeight: "bold", color: COLORS.warningText, letterSpacing: 1.2, textAlign: "right" },
  dateLabel: { fontSize: 8, color: COLORS.textMuted, textAlign: "right", marginTop: 2 },

  warningBox: { backgroundColor: COLORS.warningBg, borderWidth: 1, borderColor: COLORS.warningBorder, borderRadius: 8, padding: 10, marginBottom: 14 },
  warningLabel: { fontSize: 8, fontWeight: "bold", color: COLORS.warningText, letterSpacing: 0.8, marginBottom: 3 },
  warningText: { fontSize: 8.3, color: "#7F1D1D", lineHeight: 1.4 },

  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headBg, borderRadius: 6 },
  tableHeaderCell: { fontSize: 7.5, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 0.5, paddingVertical: 7, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  tableRowAlt: { backgroundColor: COLORS.rowAlt },
  tableCell: { fontSize: 8.8, paddingVertical: 6, paddingHorizontal: 6 },
  colIndex: { width: 22, color: COLORS.textMuted },
  colName: { flex: 1.3, fontWeight: "bold" },
  colPhone: { flex: 1, color: COLORS.textMuted },
  colPasswordWrap: { flex: 1, paddingVertical: 4, paddingHorizontal: 6 },
  passwordChip: { backgroundColor: COLORS.chipBg, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 7, alignSelf: "flex-start" },
  passwordChipText: { fontSize: 8.5, fontWeight: "bold", color: COLORS.chipText, letterSpacing: 1.1 },
  colUsername: { flex: 1, color: COLORS.textMuted },
  colCode: { flex: 1, color: COLORS.textMuted },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  summaryText: { fontSize: 8, color: COLORS.textMuted },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },
});

export type PdfCredentialRow = { fullName: string; username: string; password: string; phone?: string; institutionalCode?: string };

export type PdfCredentialsListProps = {
  institutionName: string;
  logoUrl?: string | null;
  role: "STUDENT" | "TEACHER";
  credentials: PdfCredentialRow[];
  generatedAtLabel: string;
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 (tasarım güncellemesi) — Toplu Giriş Bilgileri Listesi artık
// düz bir tablo değil; kırmızı bir güvenlik uyarı bandı ve koyu "terminal"
// şifre çipleriyle bilinçli olarak "hassas belge" hissi veren bir düzen.
// Geçici şifreler (bir kez gösterilir) DOĞRUDAN PDF'e yazılır — bu veri
// zaten çağıran tarafın kendi tarayıcı state'inde açık metin olarak
// bulunuyordu (bkz. bulk-import-wizard.tsx), sunucuya AYNI güven sınırı
// (admin oturumu) içinde bir kez daha gönderilmesi yeni bir bilgi ifşası
// OLUŞTURMUYOR; kalıcı hiçbir yere yazılmıyor.
export function PdfCredentialsList({ institutionName, logoUrl, role, credentials, generatedAtLabel }: PdfCredentialsListProps) {
  return (
    <Document title={t("Toplu Giris Bilgileri Listesi")}>
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
            <View>
              <Text style={styles.institutionName}>{t(institutionName)}</Text>
              <Text style={styles.subtitle}>{t(`Toplu Giriş Bilgileri — ${role === "STUDENT" ? "Öğrenci" : "Öğretmen"}`)}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.titleTag}>{t("GİZLİ BELGE")}</Text>
            <Text style={styles.dateLabel}>{t(generatedAtLabel)}</Text>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningLabel}>{t("TEK SEFERLİK GÖSTERİM")}</Text>
          <Text style={styles.warningText}>
            {t(
              "Bu belgede yer alan geçici şifreler yalnızca bir kez görüntülenir ve hiçbir yerde saklanmaz. Kullanıcılar ilk girişte şifrelerini değiştirmek zorundadır. Belgeyi yetkisiz kişilerle paylaşmayın."
            )}
          </Text>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, styles.colIndex]}>{t("#")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colName]}>{t("AD SOYAD")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colPhone]}>{t("TELEFON (GİRİŞ)")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colPasswordWrap]}>{t("GEÇİCİ ŞİFRE")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colUsername]}>{t("KAYIT NO")}</Text>
          {role === "TEACHER" && <Text style={[styles.tableHeaderCell, styles.colCode]}>{t("KURUMSAL KOD")}</Text>}
        </View>
        {credentials.map((c, index) => (
          <View key={`${c.username}-${index}`} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]} wrap={false}>
            <Text style={[styles.tableCell, styles.colIndex]}>{String(index + 1)}</Text>
            <Text style={[styles.tableCell, styles.colName]}>{t(c.fullName)}</Text>
            <Text style={[styles.tableCell, styles.colPhone]}>{c.phone ?? "—"}</Text>
            <View style={styles.colPasswordWrap}>
              <View style={styles.passwordChip}>
                <Text style={styles.passwordChipText}>{c.password}</Text>
              </View>
            </View>
            <Text style={[styles.tableCell, styles.colUsername]}>{c.username}</Text>
            {role === "TEACHER" && <Text style={[styles.tableCell, styles.colCode]}>{c.institutionalCode ?? "—"}</Text>}
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{t(`${credentials.length} hesap oluşturuldu`)}</Text>
          <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
        </View>
      </Page>
    </Document>
  );
}
