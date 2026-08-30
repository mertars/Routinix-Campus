import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

const COLORS = {
  pageBg: "#FDFBF7",
  text: "#2C221E",
  textMuted: "#786C66",
  hairline: "#E6E1D5",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, padding: 42, fontSize: 9 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: COLORS.hairline, paddingBottom: 12, marginBottom: 16 },
  institutionName: { fontSize: 13, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },
  dateLabel: { fontSize: 9, color: COLORS.textMuted },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.text },
  tableHeaderCell: { fontSize: 9, fontWeight: "bold", paddingVertical: 6, paddingRight: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  tableCell: { fontSize: 9, paddingVertical: 5, paddingRight: 6 },
  colIndex: { width: 24, color: COLORS.textMuted },
  colName: { flex: 1.3 },
  colPhone: { flex: 1 },
  colPassword: { flex: 1, fontWeight: "bold" },
  colUsername: { flex: 1 },
  colCode: { flex: 1 },
  footnote: { marginTop: 14, fontSize: 8, color: COLORS.textMuted, lineHeight: 1.4 },
});

export type PdfCredentialRow = { fullName: string; username: string; password: string; phone?: string; institutionalCode?: string };

export type PdfCredentialsListProps = {
  institutionName: string;
  role: "STUDENT" | "TEACHER";
  credentials: PdfCredentialRow[];
  generatedAtLabel: string;
};

function t(value: string): string {
  return turkishSafe(value);
}

// Kampüs V2 — Toplu Giriş Bilgileri Listesi (bkz. bulk-credentials-print.tsx,
// artık silindi). Geçici şifreler (bir kez gösterilir) DOĞRUDAN PDF'e
// yazılır — bu veri zaten çağıran tarafın kendi tarayıcı state'inde açık
// metin olarak bulunuyordu (bkz. bulk-import-wizard.tsx), sunucuya AYNI
// güven sınırı (admin oturumu) içinde bir kez daha gönderilmesi yeni bir
// bilgi ifşası OLUŞTURMUYOR; kalıcı hiçbir yere yazılmıyor.
export function PdfCredentialsList({ institutionName, role, credentials, generatedAtLabel }: PdfCredentialsListProps) {
  return (
    <Document title={t("Toplu Giris Bilgileri Listesi")}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.institutionName}>{t(institutionName)}</Text>
            <Text style={styles.subtitle}>{t(`Toplu Giriş Bilgileri Listesi — ${role === "STUDENT" ? "Öğrenci" : "Öğretmen"}`)}</Text>
          </View>
          <Text style={styles.dateLabel}>{t(generatedAtLabel)}</Text>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colName]}>{t("Ad Soyad")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colPhone]}>{t("Telefon (Giriş)")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colPassword]}>{t("Geçici Şifre")}</Text>
          <Text style={[styles.tableHeaderCell, styles.colUsername]}>{t("Kayıt No")}</Text>
          {role === "TEACHER" && <Text style={[styles.tableHeaderCell, styles.colCode]}>{t("Kurumsal Kod")}</Text>}
        </View>
        {credentials.map((c, index) => (
          <View key={`${c.username}-${index}`} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colIndex]}>{String(index + 1)}</Text>
            <Text style={[styles.tableCell, styles.colName]}>{t(c.fullName)}</Text>
            <Text style={[styles.tableCell, styles.colPhone]}>{c.phone ?? "—"}</Text>
            <Text style={[styles.tableCell, styles.colPassword]}>{c.password}</Text>
            <Text style={[styles.tableCell, styles.colUsername]}>{c.username}</Text>
            {role === "TEACHER" && <Text style={[styles.tableCell, styles.colCode]}>{c.institutionalCode ?? "—"}</Text>}
          </View>
        ))}

        <Text style={styles.footnote}>
          {t(
            "Giriş sayfasında sadece Telefon ve Geçici Şifre kullanılır (Kayıt No kurum kaydı içindir, girişte istenmez). Bu şifreler geçicidir ve bir kez gösterilir — kullanıcıların ilk girişte değiştirmesi zorunludur. Bu belgeyi güvenli şekilde saklayın."
          )}
        </Text>
      </Page>
    </Document>
  );
}
