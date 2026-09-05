import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. diğer PDF tasarımları — Faz F revizyonu: kullanıcı bu belgenin de
// "şık tasarım dokunuşlu" olmasını istedi, bu yüzden önceki BİLEREK çıplak
// versiyon (bkz. eski yorum) terk edildi — artık kurum logosu/adı olan,
// yumuşak turuncu bir üst şerit + numaralı kart düzenine sahip bir
// çalışma yaprağı. Yine de bir çalışma kağıdı olduğu için HER sorunun
// altında yazı yazılacak boş çizgili alan korunuyor — çözüm/cevap
// BİLEREK yok (cevap anahtarı sadece uygulama içinde).
const COLORS = {
  text: "#2C221E",
  textMuted: "#8A7C74",
  accent: "#FF6B00",
  accentDark: "#B34B00",
  hairline: "#E2DCD0",
  cardBg: "#FAF8F4",
  lineColor: "#D8D0C2",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, padding: 40, fontSize: 10 },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  logoImage: { width: 32, height: 32, borderRadius: 9, objectFit: "contain" },
  logoFallback: { width: 32, height: 32, borderRadius: 9, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  institutionName: { fontSize: 10, fontWeight: "bold", color: COLORS.textMuted, marginLeft: 9 },

  titleBar: { marginTop: 14, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  subtitle: { fontSize: 9, color: COLORS.accentDark, fontWeight: "bold", letterSpacing: 0.5, marginTop: 2 },

  nameLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, marginBottom: 16, borderBottomWidth: 1.5, borderBottomColor: COLORS.text, paddingBottom: 10 },
  nameLineField: { fontSize: 9, color: COLORS.textMuted },

  sectionLabel: { fontSize: 10, fontWeight: "bold", color: COLORS.accentDark, marginTop: 10, marginBottom: 6 },
  questionCard: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  questionHeader: { flexDirection: "row", marginBottom: 8 },
  questionNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accent, color: "#FFFFFF", fontSize: 9, fontWeight: "bold", textAlign: "center", paddingTop: 5 },
  questionPrompt: { flex: 1, fontSize: 10, lineHeight: 1.45, marginLeft: 10, marginTop: 2 },

  answerLines: { marginLeft: 32 },
  answerLine: { height: 18, borderBottomWidth: 0.75, borderBottomColor: COLORS.lineColor },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 7, color: COLORS.textMuted },
});

// `sectionLabel` isteğe bağlı — Hata Karnesi (bkz. app/api/exams/[id]/
// hata-karnesi) sorulari kazanıma göre GRUPLU gösterir; sıradan bir
// çalışma yaprağı (tek konu) bunu hiç kullanmaz (davranış AYNEN korunur).
export type PdfPracticeWorksheetQuestion = { order: number; prompt: string; sectionLabel?: string };

export type PdfPracticeWorksheetProps = {
  institutionName: string;
  logoUrl?: string | null;
  testName: string;
  subject: string;
  questions: PdfPracticeWorksheetQuestion[];
};

function t(value: string): string {
  return turkishSafe(value);
}

export function PdfPracticeWorksheet({ institutionName, logoUrl, testName, subject, questions }: PdfPracticeWorksheetProps) {
  return (
    <Document title={t(`${testName} - Calisma Yapragi`)}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
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

        <View style={styles.titleBar}>
          <Text style={styles.title}>{t(testName)}</Text>
          <Text style={styles.subtitle}>{t(subject.toUpperCase())}</Text>
        </View>

        <View style={styles.nameLine}>
          <Text style={styles.nameLineField}>{t("Ad Soyad: ______________________")}</Text>
          <Text style={styles.nameLineField}>{t("Tarih: ___/___/______")}</Text>
        </View>

        {questions.map((q, i) => (
          <View key={q.order} wrap={false}>
            {q.sectionLabel && q.sectionLabel !== questions[i - 1]?.sectionLabel && <Text style={styles.sectionLabel}>{t(q.sectionLabel)}</Text>}
            <View style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>{String(q.order)}</Text>
                <Text style={styles.questionPrompt}>{t(q.prompt)}</Text>
              </View>
              <View style={styles.answerLines}>
                <View style={styles.answerLine} />
                <View style={styles.answerLine} />
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {t("Powered by Routinix Kampüs")}
        </Text>
      </Page>
    </Document>
  );
}
