// Platform sahibi (Süper Admin) hesabını oluşturan TEK SEFERLİK bootstrap
// script'i — bkz. app/platform. Self-servis kayıt YOKTUR (kurum onboarding
// script'iyle aynı güven modeli, bkz. scripts/onboard-institution.ts): bu
// hesap türü tüm kurumları listeleyip yenilerini açabildiği için, sadece
// sunucuya/veritabanına doğrudan erişimi olan biri (siz) çalıştırabilir.
//
// Kullanım:
//   npm run create-platform-owner -- \
//     --name "Mert Arslan" \
//     --phone "05551112233" \
//     --password "GucluBirSifre123!"
//
// ⚠️ .env.local burada dotenv İLE DEĞİL, npm script'indeki `tsx --env-file`
// bayrağıyla yüklenir (bkz. scripts/onboard-institution.ts'teki aynı not —
// import hoisting nedeniyle içeride bir dotenv.config() çağrısı asla vaktinde
// yetişmez).
import { prisma } from "../lib/server/prisma";
import { hashPassword } from "../lib/server/auth/password";
import { normalizePhone } from "../lib/server/auth/otp";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`--${key} için bir değer bekleniyor.`);
    args[key] = value;
    i++;
  }
  return args;
}

function printUsageAndExit(): never {
  console.error(`Kullanım:
  npm run create-platform-owner -- \\
    --name "Mert Arslan" \\
    --phone "05551112233" \\
    --password "GucluBirSifre123!"`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fullName = args.name?.trim();
  const phoneRaw = args.phone?.trim();
  const password = args.password;

  if (!fullName || !phoneRaw || !password) {
    console.error("Eksik zorunlu parametre(ler).\n");
    printUsageAndExit();
  }
  if (password.length < 8) {
    console.error("❌ Hata: Şifre en az 8 karakter olmalı.");
    process.exit(1);
  }

  const phone = normalizePhone(phoneRaw);
  const existing = await prisma.platformOwner.findUnique({ where: { phone } });
  if (existing) {
    console.error(`❌ Hata: Bu telefon numarasıyla zaten bir platform sahibi hesabı var (${existing.fullName}).`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const owner = await prisma.platformOwner.create({ data: { fullName, phone, passwordHash } });

  console.log("\n✅ Platform sahibi hesabı oluşturuldu.\n");
  console.log(`Ad Soyad : ${owner.fullName}`);
  console.log(`Telefon  : ${owner.phone}`);
  console.log("\n/platform/login adresinden bu telefon + belirlediğiniz şifreyle giriş yapabilirsiniz.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
