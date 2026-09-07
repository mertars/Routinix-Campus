import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Öğrenci Kayıt Sözleşmesi PDF'i — Ödeme Takip modülünün zümrüt kimliğiyle.
// İmzalanmışsa velinin çizdiği imza görseli ve imza künyesi (ad, yakınlık,
// tarih) sayfanın altına basılır; imzasızsa "İMZA BEKLENİYOR" filigranı
// yerine sade bir uyarı satırı konur (belge yanlışlıkla imzalı sanılmasın).
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  headerBg: "#065F46",
  accent: "#059669",
  hairline: "#E5E7EB",
  warnBg: "#FEF3C7",
  warnText: "#92400E",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 9.5, paddingBottom: 46 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 34, paddingVertical: 14, flexDirection: "row", alignItems: "center" },
  logoImage: { width: 30, height: 30, borderRadius: 7, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 30, height: 30, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold", marginLeft: 9 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 7 },
  headerValue: { color: "#FFFFFF", fontSize: 9, fontWeight: "bold" },
  body: { paddingHorizontal: 34, paddingTop: 18 },
  title: { fontSize: 13, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  metaRow: { flexDirection: "row", gap: 18, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  metaItem: { flexDirection: "column" },
  metaLabel: { fontSize: 7, color: COLORS.textMuted },
  metaValue: { fontSize: 9.5, fontWeight: "bold" },
  paragraph: { marginBottom: 7, lineHeight: 1.5 },
  unsignedBox: { marginTop: 18, backgroundColor: COLORS.warnBg, borderRadius: 5, padding: 9 },
  unsignedText: { color: COLORS.warnText, fontSize: 8.5 },
  signBox: { marginTop: 22, borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  signCol: { width: "48%" },
  signLabel: { fontSize: 7, color: COLORS.textMuted, marginBottom: 4 },
  signatureImage: { height: 54, objectFit: "contain", marginBottom: 3 },
  signName: { fontSize: 9.5, fontWeight: "bold" },
  signMeta: { fontSize: 7.5, color: COLORS.textMuted, marginTop: 2 },
  footer: { position: "absolute", bottom: 18, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: COLORS.textMuted },
});

const t = turkishSafe;

export type ContractPdfProps = {
  institutionName: string;
  logoUrl: string | null;
  title: string;
  content: string;
  studentName: string;
  branchName: string;
  totalAmount: string | null;
  installmentCount: number | null;
  createdAt: string;
  signerName: string | null;
  signerRelation: string | null;
  signatureData: string | null;
  signedAt: string | null;
};

export function PdfStudentContract(props: ContractPdfProps) {
  const paragraphs = props.content.split("\n").filter((line) => line.trim().length > 0);
  const isSigned = Boolean(props.signatureData && props.signedAt);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          {props.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image PDF çizim primitifi, alt kabul etmez
            <Image style={styles.logoImage} src={props.logoUrl} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{t(props.institutionName.slice(0, 1).toUpperCase())}</Text>
            </View>
          )}
          <Text style={styles.institutionName}>{t(props.institutionName)}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>{t("Düzenleme Tarihi")}</Text>
            <Text style={styles.headerValue}>{t(props.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{t(props.title)}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t("ÖĞRENCİ")}</Text>
              <Text style={styles.metaValue}>{t(props.studentName)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t("SINIF / ŞUBE")}</Text>
              <Text style={styles.metaValue}>{t(props.branchName)}</Text>
            </View>
            {props.totalAmount && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t("TOPLAM ÜCRET")}</Text>
                <Text style={styles.metaValue}>{t(props.totalAmount)}</Text>
              </View>
            )}
            {props.installmentCount != null && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t("TAKSİT")}</Text>
                <Text style={styles.metaValue}>{t(`${props.installmentCount} ay`)}</Text>
              </View>
            )}
          </View>

          {paragraphs.map((line, i) => (
            <Text key={i} style={styles.paragraph}>
              {t(line)}
            </Text>
          ))}

          {isSigned ? (
            <View style={styles.signBox}>
              <View style={styles.signCol}>
                <Text style={styles.signLabel}>{t("KURUM")}</Text>
                <Text style={styles.signName}>{t(props.institutionName)}</Text>
              </View>
              <View style={styles.signCol}>
                <Text style={styles.signLabel}>{t("VELİ (ELEKTRONİK İMZA)")}</Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image PDF çizim primitifi, alt kabul etmez */}
                <Image style={styles.signatureImage} src={props.signatureData!} />
                <Text style={styles.signName}>{t(props.signerName ?? "")}</Text>
                <Text style={styles.signMeta}>
                  {t(`${props.signerRelation ? props.signerRelation + " · " : ""}${props.signedAt} tarihinde elektronik ortamda imzalanmıştır.`)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.unsignedBox}>
              <Text style={styles.unsignedText}>{t("Bu belge HENÜZ İMZALANMAMIŞTIR. Veli imzası tamamlandığında imza künyesi bu alanda yer alacaktır.")}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{t(props.institutionName)}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => t(`${pageNumber} / ${totalPages}`)} />
        </View>
      </Page>
    </Document>
  );
}
