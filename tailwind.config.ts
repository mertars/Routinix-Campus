import type { Config } from "tailwindcss";

// Dinamik vurgu rengi: her ton, ':root'a yazılan '--brand-{ton}' CSS
// değişkenine (boşlukla ayrılmış "R G B" formatında) bakar. Opaklık
// eklentisi ('bg-brand-600/15' gibi) Tailwind'in kendi renklerinde olduğu
// gibi çalışır çünkü 'opacityValue' callback'i JIT tarafından otomatik sağlanır.
function withOpacity(variableName: string) {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tailwind çalışma zamanında fonksiyon renk değerlerini destekler
        // (opaklık eklentisi için); resmi 'Config' tipi bunu modellemediğinden
        // burada kasıtlı olarak gevşetiyoruz — üretilen CSS doğru.
        brand: {
          50: withOpacity("--brand-50"),
          100: withOpacity("--brand-100"),
          300: withOpacity("--brand-300"),
          400: withOpacity("--brand-400"),
          500: withOpacity("--brand-500"),
          600: withOpacity("--brand-600"),
          700: withOpacity("--brand-700"),
          800: withOpacity("--brand-800"),
        } as unknown as Record<string, string>,
        cream: {
          DEFAULT: "#FDFBF7", // Sıcak İpek Krem — light mod arka planı
          card: "#FAFAF7",
          muted: "#F5F2EB",
        },
        espresso: {
          DEFAULT: "#2C221E", // light mod birincil metin/vurgu
          muted: "#786C66",
        },
        caramel: "#5C3D2E", // Karamel Kahvesi — dark modda görünür ısınmış vurgu
        midnight: {
          DEFAULT: "#120D0B", // Derin Gece Kahvesi — dark mod arka planı
          card: "#1C1512", // dark mod cam/kart yüzeyi
        },
        hairline: "#E6E1D5",
      },
    },
  },
  plugins: [],
};

export default config;
