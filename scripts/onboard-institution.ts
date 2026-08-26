// Yeni bir kurum (dershane/okul) + ilk SÜPER YÖNETİCİ hesabını oluşturan
// GÜVENLİ script. prisma/seed.ts ile AYNI güven modeli: platformda yeni bir
// müşteri açmak, sunucuya/veritabanına doğrudan erişimi olan operatörün
// (siz) çalıştırdığı bir komuttur — HTTP üzerinden açık bir uç nokta
// DEĞİLDİR (aksi halde kimlik doğrulaması olmadan kurum spam'lenebilirdi).
// Kullanım:
//   npm run onboard-institution -- \
//     --name "Yıldız Dershanesi" \
//     --slug "yildiz-dershanesi" \
//     --admin-name "Ayşe Yönetici" \
//     --admin-title "Kurum Müdürü" \
//     --admin-phone "05551234567" \
//     --admin-email "ayse@yildizdershanesi.com"
//
// ⚠️ .env.local burada dotenv İLE DEĞİL, npm script'indeki `tsx --env-file`
// bayrağıyla yüklenir (bkz. package.json > "onboard-institution"). Sebep:
// TypeScript, import ifadelerini dosyanın en başına taşır (hoisting) — bu
// dosyanın İÇİNDE bir dotenv.config() çağrısı, altındaki import'lardan
// (../lib/server/prisma DATABASE_URL'i import anında okur) SONRA çalışırdı,
// yani asla vaktinde yetişmezdi. Bu script'i DOĞRUDAN `tsx` ile (npm
// script'i atlayarak) çalıştırmayın — DATABASE_URL tanımsız kalır.
import { prisma } from "../lib/server/prisma";
import { createAdminAccount, AdminCreateError } from "../lib/server/admin/create-user";

const SYSTEM_ACTOR_ID = "system:onboard-institution-script";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`--${key} için bir değer bekleniyor.`);
    }
    args[key] = value;
    i++;
  }
  return args;
}

function printUsageAndExit(): never {
  console.error(`Kullanım:
  npm run onboard-institution -- \\
    --name "Yıldız Dershanesi" \\
    --slug "yildiz-dershanesi" \\
    --admin-name "Ayşe Yönetici" \\
    --admin-title "Kurum Müdürü" \\
    --admin-phone "05551234567" \\
    --admin-email "ayse@yildizdershanesi.com"`);
  process.exit(1);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name?.trim();
  const slug = (args.slug?.trim() || (name ? slugify(name) : "")).trim();
  const adminName = args["admin-name"]?.trim();
  const adminTitle = args["admin-title"]?.trim();
  const adminPhone = args["admin-phone"]?.trim();
  const adminEmail = args["admin-email"]?.trim();

  if (!name || !slug || !adminName || !adminTitle || !adminPhone || !adminEmail) {
    console.error("Eksik zorunlu parametre(ler).\n");
    printUsageAndExit();
  }

  const existingSlug = await prisma.institution.findUnique({ where: { slug } });
  if (existingSlug) {
    console.error(`Hata: "${slug}" slug'ı zaten kullanımda (${existingSlug.name}). Farklı bir --slug verin.`);
    process.exit(1);
  }

  try {
    const institution = await prisma.institution.create({
      data: { name, slug, isActive: true },
    });

    const admin = await createAdminAccount({
      institutionId: institution.id,
      actorId: SYSTEM_ACTOR_ID,
      fullName: adminName,
      title: adminTitle,
      mobilePhone: adminPhone,
      email: adminEmail,
      authorityLevel: "SUPER_ADMIN",
    });

    console.log("\n✅ Kurum başarıyla oluşturuldu.\n");
    console.log(`Kurum       : ${institution.name} (${institution.slug})`);
    console.log(`Kurum ID    : ${institution.id}`);
    console.log(`Yönetici    : ${adminName}`);
    console.log(`Kullanıcı Adı (e-posta): ${admin.username}`);
    console.log(`Geçici Şifre           : ${admin.password}`);
    console.log(
      "\n⚠️  Bu geçici şifreyi GÜVENLİ bir kanalla (yüz yüze, şifreli mesaj) iletin — burada bir daha görüntülenmeyecek."
    );
    console.log(
      "İlk girişte yönetici, telefon+OTP ile doğrulanıp kalıcı bir şifre belirleyecek (mustChangePassword=true)."
    );
  } catch (error) {
    if (error instanceof AdminCreateError) {
      console.error(`\n❌ Hata: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
