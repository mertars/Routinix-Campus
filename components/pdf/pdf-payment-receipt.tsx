import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Tahsilat Makbuzu — A5 boyutunda, veliye verilecek belge. Sayfaya İKİ
// nüsha basılır (üst: veli, alt: kurum) ve arasına kesme çizgisi konur —
// gerçek hayatta makbuz koçanı böyle çalışır, tek çıktıdan iki nüsha alınır.
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  headerBg: "#065F46",
  hairline: "#E5E7EB",
  soft: "#ECFDF5",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 8.5, padding: 14 },
  copy: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 5, overflow: "hidden", marginBottom: 7 },
  header: { backgroundColor: COLORS.headerBg, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  logo: { width: 22, height: 22, borderRadius: 5, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  institution: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold", marginLeft: 7 },
  docTitle: { marginLeft: "auto", color: "#FFFFFF", fontSize: 9, fontWeight: "bold" },
  copyLabel: { color: "rgba(255,255,255,0.7)", fontSize: 6.5, marginLeft: 6 },
  body: { padding: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  metaItem: {},
  label: { fontSize: 6.5, color: COLORS.textMuted },
  value: { fontSize: 9, fontWeight: "bold" },
  amountBox: { backgroundColor: COLORS.soft, borderRadius: 4, padding: 8, marginBottom: 7 },
  amountFigure: { fontSize: 16, fontWeight: "bold", color: COLORS.headerBg },
  amountWords: { fontSize: 7.5, color: COLORS.textMuted, marginTop: 2 },
  line: { flexDirection: "row", marginBottom: 3 },
  lineLabel: { width: 72, fontSize: 7.5, color: COLORS.textMuted },
  lineValue: { flex: 1, fontSize: 8.5 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  signBox: { width: "45%", borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 4 },
  signLabel: { fontSize: 6.5, color: COLORS.textMuted },
  cutLine: { borderTopWidth: 1, borderTopColor: COLORS.hairline, borderTopStyle: "dashed", marginBottom: 7 },
  footNote: { fontSize: 6.5, color: COLORS.textMuted, marginTop: 6 },
});

const t = turkishSafe;

export type ReceiptProps = {
  institutionName: string;
  logoUrl: string | null;
  receiptNo: string;
  paidAt: string;
  studentName: string;
  branchName: string;
  parentName: string | null;
  installmentTitle: string;
  amountFigure: string;
  amountWords: string;
  methodLabel: string;
  accountName: string;
  collectedBy: string;
  note: string | null;
};

function ReceiptCopy({ props, copyLabel }: { props: ReceiptProps; copyLabel: string }) {
  return (
    <View style={styles.copy} wrap={false}>
      <View style={styles.header}>
        {props.logoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image PDF çizim primitifi, alt kabul etmez
          <Image style={styles.logo} src={props.logoUrl} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>{t(props.institutionName.slice(0, 1).toUpperCase())}</Text>
          </View>
        )}
        <Text style={styles.institution}>{t(props.institutionName)}</Text>
        <Text style={styles.docTitle}>{t("TAHSİLAT MAKBUZU")}</Text>
        <Text style={styles.copyLabel}>{t(copyLabel)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("MAKBUZ NO")}</Text>
            <Text style={styles.value}>{t(props.receiptNo)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("TARİH")}</Text>
            <Text style={styles.value}>{t(props.paidAt)}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.label}>{t("TAHSİL EDİLEN TUTAR")}</Text>
          <Text style={styles.amountFigure}>{t(props.amountFigure)}</Text>
          <Text style={styles.amountWords}>{t(`Yalnız ${props.amountWords}`)}</Text>
        </View>

        <View style={styles.line}>
          <Text style={styles.lineLabel}>{t("Öğrenci")}</Text>
          <Text style={styles.lineValue}>{t(`${props.studentName} · ${props.branchName}`)}</Text>
        </View>
        {props.parentName && (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>{t("Veli")}</Text>
            <Text style={styles.lineValue}>{t(props.parentName)}</Text>
          </View>
        )}
        <View style={styles.line}>
          <Text style={styles.lineLabel}>{t("Açıklama")}</Text>
          <Text style={styles.lineValue}>{t(props.installmentTitle)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>{t("Ödeme Şekli")}</Text>
          <Text style={styles.lineValue}>{t(`${props.methodLabel} · ${props.accountName}`)}</Text>
        </View>
        {props.note && (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>{t("Not")}</Text>
            <Text style={styles.lineValue}>{t(props.note)}</Text>
          </View>
        )}

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>{t(`TAHSİL EDEN · ${props.collectedBy}`)}</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>{t("TESLİM ALAN / VELİ İMZA")}</Text>
          </View>
        </View>

        <Text style={styles.footNote}>{t("Bu belge tahsilat kaydının bilgi amaçlı çıktısıdır; resmî fatura yerine geçmez.")}</Text>
      </View>
    </View>
  );
}

export function PdfPaymentReceipt(props: ReceiptProps) {
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <ReceiptCopy props={props} copyLabel="VELİ NÜSHASI" />
        <View style={styles.cutLine} />
        <ReceiptCopy props={props} copyLabel="KURUM NÜSHASI" />
      </Page>
    </Document>
  );
}
