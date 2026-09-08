import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Öğrenci Cari Ekstresi — A4, veliye verilecek tam döküm.
//
// Makbuz TEK bir tahsilatı belgeler; ekstre ise öğrencinin BÜTÜN finansal
// hikâyesini tek sayfada anlatır: plan, indirimler, ödenenler, kalan borç.
// Veli görüşmesinde masaya konan belge budur.
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  headerBg: "#065F46",
  hairline: "#E5E7EB",
  soft: "#ECFDF5",
  rowAlt: "#F9FAFB",
  danger: "#B91C1C",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 8, padding: 26 },
  header: {
    backgroundColor: COLORS.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 5,
    marginBottom: 10,
  },
  logo: { width: 22, height: 22, borderRadius: 5, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  institution: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold", marginLeft: 7 },
  docTitle: { marginLeft: "auto", color: "#FFFFFF", fontSize: 9.5, fontWeight: "bold" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaItem: { marginRight: 16 },
  label: { fontSize: 6.5, color: COLORS.textMuted },
  value: { fontSize: 9, fontWeight: "bold" },

  // Hücre sayısı indirim/iade varlığına göre 3-6 arasında değişir; sabit
  // genişlik + wrap ile altıncı hücre ikinci satıra düşer, hiçbiri
  // okunamayacak kadar daralmaz.
  summary: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  summaryCell: {
    width: "19%",
    backgroundColor: COLORS.soft,
    borderRadius: 4,
    padding: 7,
    marginRight: "0.75%",
    marginBottom: 4,
  },
  summaryValue: { fontSize: 10.5, fontWeight: "bold", color: COLORS.headerBg, marginTop: 1 },
  summaryValueDanger: { fontSize: 10.5, fontWeight: "bold", color: COLORS.danger, marginTop: 1 },
  summaryNote: { fontSize: 6, color: COLORS.textMuted, marginTop: 1 },

  refundBlock: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 4,
    padding: 8,
  },
  refundTitle: { fontSize: 8, fontWeight: "bold", marginBottom: 3 },
  refundLine: { flexDirection: "row", marginBottom: 2 },
  refundLabel: { width: 110, fontSize: 7, color: COLORS.textMuted },
  refundValue: { flex: 1, fontSize: 7.5 },

  sectionTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 5, marginTop: 4 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.headerBg, paddingBottom: 3, marginBottom: 2 },
  th: { fontSize: 6.5, color: COLORS.textMuted, fontWeight: "bold" },
  row: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  rowAlt: { backgroundColor: COLORS.rowAlt },
  td: { fontSize: 7.5 },
  tdDanger: { fontSize: 7.5, color: COLORS.danger },
  totalRow: { flexDirection: "row", paddingTop: 4, marginTop: 1 },
  totalText: { fontSize: 8, fontWeight: "bold" },

  right: { textAlign: "right" },
  empty: { fontSize: 7.5, color: COLORS.textMuted, paddingVertical: 8, textAlign: "center" },
  footNote: { fontSize: 6.5, color: COLORS.textMuted, marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 6 },
  pageNo: { position: "absolute", bottom: 14, right: 26, fontSize: 6.5, color: COLORS.textMuted },
});

// Taksit tablosu sütun genişlikleri — toplamı 100 olmalı
const INST = { due: 13, title: 37, amount: 13, paid: 13, remaining: 13, status: 11 };
// Tahsilat tablosu
const PAY = { date: 13, receipt: 13, title: 35, method: 20, amount: 19 };

const t = turkishSafe;

export type StatementInstallment = {
  dueDate: string;
  title: string;
  amount: string;
  paid: string;
  remaining: string;
  statusLabel: string;
  isOverdue: boolean;
};

export type StatementPayment = {
  paidAt: string;
  receiptNo: string;
  title: string;
  method: string;
  amount: string;
};

export type StatementProps = {
  institutionName: string;
  logoUrl: string | null;
  generatedAt: string;
  studentName: string;
  studentNo: string;
  branchName: string;
  parentName: string | null;
  planTotal: string;
  discountTotal: string | null;
  discountTypes: string | null;
  /** Kurumun bu öğrenciden aldığı TÜM para (serbest tahsilatlar dahil). */
  collectedTotal: string;
  /** Yalnızca yaşayan taksitlere yapılmış ödeme — taksit tablosunun toplamı. */
  installmentPaidTotal: string;
  remainingTotal: string;
  overdueTotal: string;
  hasOverdue: boolean;
  /** İade varsa dolu — yoksa ilgili bölümler hiç basılmaz. */
  refundTotal: string | null;
  netCollectedTotal: string | null;
  cancellations: {
    date: string;
    reason: string;
    cancelledCount: string;
    cancelledAmount: string;
    refundAmount: string;
  }[];
  installments: StatementInstallment[];
  payments: StatementPayment[];
};

export function PdfStudentStatement(props: StatementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
          <Text style={styles.docTitle}>{t("ÖĞRENCİ CARİ EKSTRESİ")}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("ÖĞRENCİ")}</Text>
            <Text style={styles.value}>{t(props.studentName)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("ÖĞRENCİ NO")}</Text>
            <Text style={styles.value}>{t(props.studentNo)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("SINIF / ŞUBE")}</Text>
            <Text style={styles.value}>{t(props.branchName)}</Text>
          </View>
          {props.parentName && (
            <View style={styles.metaItem}>
              <Text style={styles.label}>{t("VELİ")}</Text>
              <Text style={styles.value}>{t(props.parentName)}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.label}>{t("DÜZENLEME TARİHİ")}</Text>
            <Text style={styles.value}>{t(props.generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <SummaryCell label="PLAN TOPLAMI" value={props.planTotal} />
          {props.discountTotal && (
            <SummaryCell label="UYGULANAN İNDİRİM" value={props.discountTotal} note={props.discountTypes} />
          )}
          <SummaryCell label="TAHSİL EDİLEN" value={props.collectedTotal} />
          {props.refundTotal && (
            <SummaryCell label="İADE EDİLEN" value={props.refundTotal} note={`Net: ${props.netCollectedTotal}`} />
          )}
          <SummaryCell label="KALAN BORÇ" value={props.remainingTotal} />
          <SummaryCell label="VADESİ GEÇMİŞ" value={props.overdueTotal} danger={props.hasOverdue} />
        </View>

        <Text style={styles.sectionTitle}>{t("TAKSİT PLANI")}</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: `${INST.due}%` }]}>{t("VADE")}</Text>
          <Text style={[styles.th, { width: `${INST.title}%` }]}>{t("AÇIKLAMA")}</Text>
          <Text style={[styles.th, styles.right, { width: `${INST.amount}%` }]}>{t("TUTAR")}</Text>
          <Text style={[styles.th, styles.right, { width: `${INST.paid}%` }]}>{t("ÖDENEN")}</Text>
          <Text style={[styles.th, styles.right, { width: `${INST.remaining}%` }]}>{t("KALAN")}</Text>
          <Text style={[styles.th, styles.right, { width: `${INST.status}%` }]}>{t("DURUM")}</Text>
        </View>
        {props.installments.length === 0 ? (
          <Text style={styles.empty}>{t("Tanımlı taksit planı yok.")}</Text>
        ) : (
          props.installments.map((row, i) => (
            <View key={`${row.dueDate}-${i}`} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
              <Text style={[styles.td, { width: `${INST.due}%` }]}>{t(row.dueDate)}</Text>
              <Text style={[styles.td, { width: `${INST.title}%` }]}>{t(row.title)}</Text>
              <Text style={[styles.td, styles.right, { width: `${INST.amount}%` }]}>{t(row.amount)}</Text>
              <Text style={[styles.td, styles.right, { width: `${INST.paid}%` }]}>{t(row.paid)}</Text>
              <Text style={[row.isOverdue ? styles.tdDanger : styles.td, styles.right, { width: `${INST.remaining}%` }]}>
                {t(row.remaining)}
              </Text>
              <Text style={[row.isOverdue ? styles.tdDanger : styles.td, styles.right, { width: `${INST.status}%` }]}>
                {t(row.statusLabel)}
              </Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={[styles.totalText, { width: `${INST.due + INST.title}%` }]}>{t("TOPLAM")}</Text>
          <Text style={[styles.totalText, styles.right, { width: `${INST.amount}%` }]}>{t(props.planTotal)}</Text>
          <Text style={[styles.totalText, styles.right, { width: `${INST.paid}%` }]}>{t(props.installmentPaidTotal)}</Text>
          <Text style={[styles.totalText, styles.right, { width: `${INST.remaining}%` }]}>{t(props.remainingTotal)}</Text>
          <Text style={[styles.totalText, styles.right, { width: `${INST.status}%` }]}> </Text>
        </View>

        <Text style={styles.sectionTitle}>{t("TAHSİLAT GEÇMİŞİ")}</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: `${PAY.date}%` }]}>{t("TARİH")}</Text>
          <Text style={[styles.th, { width: `${PAY.receipt}%` }]}>{t("MAKBUZ NO")}</Text>
          <Text style={[styles.th, { width: `${PAY.title}%` }]}>{t("AÇIKLAMA")}</Text>
          <Text style={[styles.th, { width: `${PAY.method}%` }]}>{t("ÖDEME ŞEKLİ")}</Text>
          <Text style={[styles.th, styles.right, { width: `${PAY.amount}%` }]}>{t("TUTAR")}</Text>
        </View>
        {props.payments.length === 0 ? (
          <Text style={styles.empty}>{t("Henüz tahsilat kaydı yok.")}</Text>
        ) : (
          props.payments.map((row, i) => (
            <View key={`${row.receiptNo}-${i}`} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
              <Text style={[styles.td, { width: `${PAY.date}%` }]}>{t(row.paidAt)}</Text>
              <Text style={[styles.td, { width: `${PAY.receipt}%` }]}>{t(row.receiptNo)}</Text>
              <Text style={[styles.td, { width: `${PAY.title}%` }]}>{t(row.title)}</Text>
              <Text style={[styles.td, { width: `${PAY.method}%` }]}>{t(row.method)}</Text>
              <Text style={[styles.td, styles.right, { width: `${PAY.amount}%` }]}>{t(row.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={[styles.totalText, { width: `${PAY.date + PAY.receipt + PAY.title + PAY.method}%` }]}>
            {t("TAHSİL EDİLEN TOPLAM")}
          </Text>
          <Text style={[styles.totalText, styles.right, { width: `${PAY.amount}%` }]}>{t(props.collectedTotal)}</Text>
        </View>
        {props.refundTotal && (
          <>
            <View style={styles.totalRow}>
              <Text style={[styles.totalText, { width: `${PAY.date + PAY.receipt + PAY.title + PAY.method}%` }]}>
                {t("İADE EDİLEN (−)")}
              </Text>
              <Text style={[styles.totalText, styles.right, { width: `${PAY.amount}%` }]}>{t(props.refundTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalText, { width: `${PAY.date + PAY.receipt + PAY.title + PAY.method}%` }]}>
                {t("KURUMDA KALAN NET TUTAR")}
              </Text>
              <Text style={[styles.totalText, styles.right, { width: `${PAY.amount}%` }]}>
                {t(props.netCollectedTotal ?? "")}
              </Text>
            </View>
          </>
        )}

        {/* Kayıt iptali, ekstrenin en çok soru doğuran kalemidir: taksitler
            neden eksik, para nereye gitti? Bu blok ikisini de yazılı olarak
            cevaplar. */}
        {props.cancellations.map((c, i) => (
          <View key={`${c.date}-${i}`} style={styles.refundBlock} wrap={false}>
            <Text style={styles.refundTitle}>{t(`KAYIT İPTALİ · ${c.date}`)}</Text>
            <View style={styles.refundLine}>
              <Text style={styles.refundLabel}>{t("Gerekçe")}</Text>
              <Text style={styles.refundValue}>{t(c.reason)}</Text>
            </View>
            <View style={styles.refundLine}>
              <Text style={styles.refundLabel}>{t("İptal edilen taksit")}</Text>
              <Text style={styles.refundValue}>{t(`${c.cancelledCount} adet · ${c.cancelledAmount}`)}</Text>
            </View>
            <View style={styles.refundLine}>
              <Text style={styles.refundLabel}>{t("İade edilen tutar")}</Text>
              <Text style={styles.refundValue}>{t(c.refundAmount)}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.footNote}>
          {t(
            "Bu belge, düzenleme tarihi itibarıyla sistemdeki kayıtların bilgi amaçlı dökümüdür; resmî fatura yerine geçmez. İptal edilen taksit ve tahsilatlar ekstreye dahil edilmemiştir."
          )}
        </Text>

        <Text style={styles.pageNo} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

function SummaryCell({
  label,
  value,
  note,
  danger,
}: {
  label: string;
  value: string;
  note?: string | null;
  danger?: boolean;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.label}>{t(label)}</Text>
      <Text style={danger ? styles.summaryValueDanger : styles.summaryValue}>{t(value)}</Text>
      {note && <Text style={styles.summaryNote}>{t(note)}</Text>}
    </View>
  );
}
