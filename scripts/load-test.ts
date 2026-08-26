// Basit, tekrarlanabilir bir HTTP yük testi (autocannon). SADECE yerel/staging
// bir ortama karşı çalıştırın — .env.local'daki DATABASE_URL'in gösterdiği
// veritabanına GERÇEK yük bindirir.
//
// Kullanım:
//   npm run load-test -- --path /api/health --connections 50 --duration 15
//   npm run load-test -- --path /api/admin/dashboard --cookie "<oturum-cookie-değeri>" --connections 30 --duration 15
//
// --cookie: kimlik doğrulaması gereken bir ucu test etmek için tarayıcıdan
// (DevTools > Application > Cookies > routinix-kampus-session) kopyalanan
// ham JWT değeri.
import autocannon from "autocannon";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    args[key] = value && !value.startsWith("--") ? value : "true";
    if (value && !value.startsWith("--")) i++;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url ?? "http://localhost:3000";
  const path = args.path ?? "/api/health";
  const connections = Number(args.connections ?? 20);
  const duration = Number(args.duration ?? 10);
  const cookie = args.cookie;

  if (baseUrl.includes("neon.tech") || baseUrl.includes("vercel.app") || (!baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1"))) {
    console.error("❌ Güvenlik: --url yerel görünmüyor. Bu araç SADECE yerel/staging ortama karşı çalıştırılmalıdır.");
    process.exit(1);
  }

  console.log(`\n🔥 Yük testi: ${baseUrl}${path}`);
  console.log(`   Eşzamanlı "kullanıcı" (bağlantı): ${connections} | Süre: ${duration}s\n`);

  let clientCounter = 0;
  const result = await autocannon({
    url: `${baseUrl}${path}`,
    connections,
    duration,
    headers: cookie ? { cookie: `routinix-kampus-session=${cookie}` } : undefined,
    setupClient: (client) => {
      clientCounter += 1;
      // Her "sanal kullanıcı" (bağlantı) farklı bir IP'den geliyormuş gibi
      // görünür — aksi halde genel rate limiter (bkz.
      // lib/server/rate-limit/general-rate-limit.ts) TEK bir kaynak IP'den
      // gelen tüm trafiği aynı kovaya koyar ve gerçekte uygulamanın
      // KAPASİTESİNİ değil, RATE LIMITER'IN çalıştığını ölçmüş oluruz
      // (ki o da ayrıca doğrulanmaya değer, ama farklı bir testtir).
      const a = (clientCounter >> 16) & 255;
      const b = (clientCounter >> 8) & 255;
      const c = clientCounter & 255;
      client.setHeaders({ "x-forwarded-for": `10.${a}.${b}.${c}` });
    },
  });

  console.log(autocannon.printResult(result));

  console.log("Özet:");
  console.log(`  2xx: ${result["2xx"]}  4xx: ${result["4xx"]}  5xx: ${result["5xx"]}  bağlantı hatası: ${result.errors}  timeout: ${result.timeouts}`);
  console.log(`  Gecikme (ms) — p50: ${result.latency.p50}  p99: ${result.latency.p99}  max: ${result.latency.max}`);
  console.log(`  Saniyede istek — ort: ${result.requests.average}  p99: ${result.requests.p99}\n`);

  if (result.errors > 0 || result["5xx"] > 0) {
    console.error("⚠️  Test sırasında hata/5xx görüldü — yukarıdaki ayrıntılara bakın.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
