import { Document, Page, View, Text, Image, Svg, Line, Circle, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. components/pdf/pdf-report-card.tsx — kurum kimliğiyle aynı temel
// renkler, ama BİLEREK FARKLI bir tasarım dili: Karne yoğun/veri-ağırlıklı
// bir "sertifika", buradaki iki belge ise BİRBİRİNDEN de farklı iki ayrı
// gerçek dünya nesnesini taklit ediyor — "entry" bir UÇAK BİNİŞ KARTI/BİLET
// (tek öğrenci, az veri, çok beyaz alan), "doorList" ise kapıya asılan bir
// SALON MANİFESTOSU (çok veri, yoğun/taranabilir tablo). Aynı şablonun
// kopyalanması BİLEREK yapılmadı.
const COLORS = {
  pageBg: "#FFFFFF",
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  stub: "#2C221E",
  hairline: "#EDE7DC",
  cardBg: "#FDFBF7",
  zebra: "#F7F3EA",
  headerBar: "#2C221E",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.pageBg, color: COLORS.text, fontSize: 9.5 },

  // ---------- ENTRY (bilet) ----------
  entryTopBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 48, paddingTop: 44, marginBottom: 60 },
  entryLogo: { width: 26, height: 26, borderRadius: 7, objectFit: "contain" },
  entryLogoFallback: { width: 26, height: 26, borderRadius: 7, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  entryLogoFallbackText: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  entryInstitutionName: { fontSize: 10, fontWeight: "bold", color: COLORS.textMuted, marginLeft: 8, letterSpacing: 0.3 },

  ticketRow: { flexDirection: "row", alignSelf: "center", width: 480 },
  ticketMain: {
    width: 332,
    height: 236,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: COLORS.hairline,
    padding: 26,
  },
  ticketBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,107,0,0.12)", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 14 },
  ticketBadgeText: { fontSize: 7.5, fontWeight: "bold", color: COLORS.accentDark, letterSpacing: 1 },
  examName: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  examMetaRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  examMetaLabel: { fontSize: 8, color: COLORS.textMuted },
  examMetaValue: { fontSize: 8, fontWeight: "bold" },
  ticketDivider: { height: 1, backgroundColor: COLORS.hairline, marginBottom: 16 },
  studentBlock: { flexDirection: "row", alignItems: "center" },
  ticketAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,107,0,0.12)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  ticketAvatarText: { fontSize: 16, fontWeight: "bold", color: COLORS.accentDark },
  ticketStudentName: { fontSize: 15, fontWeight: "bold" },
  ticketStudentBranch: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },

  ticketStub: {
    width: 140,
    height: 236,
    backgroundColor: COLORS.stub,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  stubLabel: { fontSize: 7, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5, fontWeight: "bold" },
  stubSeatNumber: { fontSize: 46, fontWeight: "bold", color: "#FFFFFF" },
  barcodeRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 26 },

  entryFootnoteWrap: { alignItems: "center", marginTop: 26 },
  entryFootnote: { fontSize: 8, color: COLORS.textMuted, textAlign: "center", maxWidth: 340, lineHeight: 1.5 },

  entryWatermarkWrap: { position: "absolute", bottom: 28, right: 0, left: 0, alignItems: "center" },
  watermark: { fontSize: 7, color: COLORS.textMuted, opacity: 0.6 },

  // ---------- DOOR LIST (manifesto) ----------
  doorHeaderBar: { backgroundColor: COLORS.headerBar, paddingHorizontal: 40, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  doorHeaderLeft: { flexDirection: "row", alignItems: "center" },
  doorLogo: { width: 34, height: 34, borderRadius: 9, objectFit: "contain" },
  doorLogoFallback: { width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  doorLogoFallbackText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
  doorInstitutionName: { fontSize: 13, fontWeight: "bold", color: "#FFFFFF", marginLeft: 10 },
  doorSubtitle: { fontSize: 8, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, marginLeft: 10, marginTop: 2 },
  doorMetaBlock: { alignItems: "flex-end" },
  doorMetaLine: { fontSize: 8.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 },
  doorMetaLineBold: { fontSize: 8.5, color: "#FFFFFF", fontWeight: "bold", marginBottom: 2 },

  doorBody: { paddingHorizontal: 40, paddingTop: 24, paddingBottom: 30, flexDirection: "row", gap: 16 },
  doorColumn: { flex: 1, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 10, overflow: "hidden" },
  doorColHeaderRow: { flexDirection: "row", backgroundColor: "rgba(255,107,0,0.12)" },
  doorColHeaderCell: { fontSize: 7.5, fontWeight: "bold", color: COLORS.accentDark, paddingVertical: 6, letterSpacing: 0.4 },
  doorRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.hairline },
  doorRowZebra: { backgroundColor: COLORS.zebra },
  doorCell: { fontSize: 8.5, paddingVertical: 5 },
  doorColSeat: { width: 34, paddingLeft: 8 },
  doorColStudent: { flex: 1.3 },
  doorColBranch: { flex: 1, color: COLORS.textMuted },

  doorFooterRow: { paddingHorizontal: 40, flexDirection: "row", justifyContent: "flex-end" },
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

function Barcode() {
  const widths = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3];
  return (
    <View style={styles.barcodeRow}>
      {widths.map((w, i) => (
        <View key={i} style={{ width: w, height: 22, backgroundColor: "rgba(255,255,255,0.65)" }} />
      ))}
    </View>
  );
}

function EntryTicket({ institutionName, logoUrl, hall, examName, examDate, seat }: Omit<PdfExamDocumentProps, "mode" | "seats"> & { seat: PdfExamSeat }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.entryTopBar}>
        {logoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
          <Image src={logoUrl} style={styles.entryLogo} />
        ) : (
          <View style={styles.entryLogoFallback}>
            <Text style={styles.entryLogoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.entryInstitutionName}>{t(institutionName).toUpperCase()}</Text>
      </View>

      <View style={styles.ticketRow}>
        <View style={styles.ticketMain}>
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>{t("SINAV GİRİŞ KARTI")}</Text>
          </View>
          <Text style={styles.examName}>{t(examName)}</Text>
          <View style={styles.examMetaRow}>
            <Text>
              <Text style={styles.examMetaLabel}>{t("Tarih  ")}</Text>
              <Text style={styles.examMetaValue}>{t(examDate)}</Text>
            </Text>
            <Text>
              <Text style={styles.examMetaLabel}>{t("Salon  ")}</Text>
              <Text style={styles.examMetaValue}>{t(hall)}</Text>
            </Text>
          </View>
          <View style={styles.ticketDivider} />
          <View style={styles.studentBlock}>
            <View style={styles.ticketAvatar}>
              <Text style={styles.ticketAvatarText}>{t(seat.studentName).charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.ticketStudentName}>{t(seat.studentName)}</Text>
              <Text style={styles.ticketStudentBranch}>{t(seat.branchName)}</Text>
            </View>
          </View>
        </View>

        <View style={{ width: 8, height: 236, backgroundColor: COLORS.cardBg }}>
          <Svg width={8} height={236} viewBox="0 0 8 236">
            <Line x1={4} y1={16} x2={4} y2={220} stroke={COLORS.hairline} strokeWidth={1.6} strokeDasharray="4, 4" />
            <Circle cx={4} cy={0} r={9} fill={COLORS.pageBg} />
            <Circle cx={4} cy={236} r={9} fill={COLORS.pageBg} />
          </Svg>
        </View>

        <View style={styles.ticketStub}>
          <Text style={styles.stubLabel}>{t("KOLTUK NO")}</Text>
          <Text style={styles.stubSeatNumber}>{String(seat.seatNumber)}</Text>
          <Barcode />
        </View>
      </View>

      <View style={styles.entryFootnoteWrap}>
        <Text style={styles.entryFootnote}>
          {t("Sınav saatinden 30 dakika önce salonda hazır bulununuz. Bu belge ve kimlik kartınız salon girişinde kontrol edilecektir.")}
        </Text>
      </View>

      <View style={styles.entryWatermarkWrap}>
        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </View>
    </Page>
  );
}

function DoorList({ institutionName, logoUrl, hall, examName, examDate, seats }: Omit<PdfExamDocumentProps, "mode" | "seat"> & { seats: PdfExamSeat[] }) {
  const mid = Math.ceil(seats.length / 2);
  const columns = [seats.slice(0, mid), seats.slice(mid)];

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.doorHeaderBar}>
        <View style={styles.doorHeaderLeft}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf'in Image bileşeni (PDF çizim primitifi, next/image DEĞİL) alt kabul etmiyor
            <Image src={logoUrl} style={styles.doorLogo} />
          ) : (
            <View style={styles.doorLogoFallback}>
              <Text style={styles.doorLogoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.doorInstitutionName}>{t(institutionName)}</Text>
            <Text style={styles.doorSubtitle}>{t("SALON KAPI LİSTESİ")}</Text>
          </View>
        </View>
        <View style={styles.doorMetaBlock}>
          <Text style={styles.doorMetaLineBold}>{t(examName)}</Text>
          <Text style={styles.doorMetaLine}>{`${t(examDate)} · ${t(hall)}`}</Text>
          <Text style={styles.doorMetaLine}>{t(`${seats.length} koltuk`)}</Text>
        </View>
      </View>

      <View style={styles.doorBody}>
        {columns.map((col, colIndex) => (
          <View key={colIndex} style={styles.doorColumn}>
            <View style={styles.doorColHeaderRow}>
              <Text style={[styles.doorColHeaderCell, styles.doorColSeat]}>{t("NO")}</Text>
              <Text style={[styles.doorColHeaderCell, styles.doorColStudent]}>{t("ÖĞRENCİ")}</Text>
              <Text style={[styles.doorColHeaderCell, styles.doorColBranch]}>{t("ŞUBE")}</Text>
            </View>
            {col.map((row, rowIndex) => (
              <View key={row.seatNumber} style={[styles.doorRow, rowIndex % 2 === 1 ? styles.doorRowZebra : undefined]}>
                <Text style={[styles.doorCell, styles.doorColSeat, { fontWeight: "bold" }]}>{String(row.seatNumber)}</Text>
                <Text style={[styles.doorCell, styles.doorColStudent]}>{t(row.studentName)}</Text>
                <Text style={[styles.doorCell, styles.doorColBranch]}>{t(row.branchName)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.doorFooterRow}>
        <Text style={styles.watermark}>{t("Powered by Routinix Kampüs")}</Text>
      </View>
    </Page>
  );
}

// Kampüs V2 — Sınav Giriş Belgesi (biniş kartı/bilet üslubu) ve Salon Kapı
// Listesi (kapıya asılan manifesto üslubu) — bkz. dosya başındaki tasarım
// dili notu.
export function PdfExamDocument({ institutionName, logoUrl, mode, hall, examName, examDate, seat, seats }: PdfExamDocumentProps) {
  return (
    <Document title={t(mode === "entry" ? "Sinav Giris Belgesi" : "Salon Kapi Listesi")}>
      {mode === "entry" && seat ? (
        <EntryTicket institutionName={institutionName} logoUrl={logoUrl} hall={hall} examName={examName} examDate={examDate} seat={seat} />
      ) : (
        <DoorList institutionName={institutionName} logoUrl={logoUrl} hall={hall} examName={examName} examDate={examDate} seats={seats ?? []} />
      )}
    </Document>
  );
}
