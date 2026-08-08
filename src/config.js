const httpUrlFields = [
  ["couple.groom.instagram.url", (settings) => settings.couple?.groom?.instagram?.url],
  ["couple.bride.instagram.url", (settings) => settings.couple?.bride?.instagram?.url],
  ["events.0.mapUrl", (settings) => settings.events?.[0]?.mapUrl],
  ["events.1.mapUrl", (settings) => settings.events?.[1]?.mapUrl]
];

export const DEFAULT_SETTINGS = {
  couple: {
    groom: { name: "Budi Setiawan", shortName: "Budi", instagram: { handle: "@budisetiawan.gg", url: "https://instagram.com/budisetiawan.gg" } },
    bride: { name: "Widia Hasmiati", shortName: "Widia", instagram: { handle: "@widia_hsm", url: "https://instagram.com/widia_hsm" } }
  },
  wedding: { countdownTarget: "2026-12-31T09:00:00+07:00" },
  events: [
    { type: "Akad Nikah", date: "2026-12-31", time: "Pukul 09:00 WIB - Selesai", venue: "Masjid Raya Verona", address: "Jl. Cinta Damai No. 1, Kota Verona", mapUrl: "https://maps.google.com/" },
    { type: "Resepsi", date: "2026-12-31", time: "Pukul 11:00 WIB - 14:00 WIB", venue: "Gedung Verona Center", address: "Jl. Cinta Damai No. 10, Kota Verona", mapUrl: "https://maps.google.com/" }
  ],
  accounts: [
    { bank: "BCA", number: "1234567890", holder: "Budi Setiawan" },
    { bank: "BRI", number: "0987654321", holder: "Widia Hasmiati" }
  ]
};

function cleanText(value, label, max = 250) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned || cleaned.length > max) throw new Error(`${label} wajib diisi dan maksimal ${max} karakter`);
  return cleaned;
}

function cleanUrl(value, label) {
  const cleaned = cleanText(value, label, 500);
  try {
    const url = new URL(cleaned);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return cleaned;
  } catch {
    throw new Error(`${label} harus berupa URL http/https yang valid`);
  }
}

function cleanDate(value, label) {
  const cleaned = cleanText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(Date.parse(`${cleaned}T00:00:00Z`))) {
    throw new Error(`${label} harus memakai format YYYY-MM-DD`);
  }
  return cleaned;
}

export function validateSettings(input) {
  const countdownTarget = cleanText(input?.wedding?.countdownTarget, "Countdown", 40);
  if (Number.isNaN(Date.parse(countdownTarget)) || !/[+-]\d{2}:\d{2}$|Z$/.test(countdownTarget)) {
    throw new Error("Countdown harus berupa ISO 8601 dengan zona waktu");
  }
  const settings = {
    couple: {
      groom: {
        name: cleanText(input?.couple?.groom?.name, "Nama lengkap laki-laki", 100),
        shortName: cleanText(input?.couple?.groom?.shortName, "Nama pendek laki-laki", 50),
        instagram: {
          handle: cleanText(input?.couple?.groom?.instagram?.handle, "Instagram laki-laki", 100),
          url: input?.couple?.groom?.instagram?.url
        }
      },
      bride: {
        name: cleanText(input?.couple?.bride?.name, "Nama lengkap perempuan", 100),
        shortName: cleanText(input?.couple?.bride?.shortName, "Nama pendek perempuan", 50),
        instagram: {
          handle: cleanText(input?.couple?.bride?.instagram?.handle, "Instagram perempuan", 100),
          url: input?.couple?.bride?.instagram?.url
        }
      }
    },
    wedding: { countdownTarget },
    events: [0, 1].map((index) => ({
      type: index === 0 ? "Akad Nikah" : "Resepsi",
      date: cleanDate(input?.events?.[index]?.date, `Tanggal ${index === 0 ? "akad" : "resepsi"}`),
      time: cleanText(input?.events?.[index]?.time, `Waktu ${index === 0 ? "akad" : "resepsi"}`, 100),
      venue: cleanText(input?.events?.[index]?.venue, `Lokasi ${index === 0 ? "akad" : "resepsi"}`, 150),
      address: cleanText(input?.events?.[index]?.address, `Alamat ${index === 0 ? "akad" : "resepsi"}`, 300),
      mapUrl: input?.events?.[index]?.mapUrl
    })),
    accounts: [0, 1].map((index) => ({
      bank: cleanText(input?.accounts?.[index]?.bank, `Bank ${index + 1}`, 50),
      number: cleanText(input?.accounts?.[index]?.number, `Nomor rekening ${index + 1}`, 100),
      holder: cleanText(input?.accounts?.[index]?.holder, `Pemilik rekening ${index + 1}`, 100)
    }))
  };
  for (const [label, getter] of httpUrlFields) {
    const value = cleanUrl(getter(settings), label);
    const path = label.split(".");
    if (path[0] === "couple") settings.couple[path[1]].instagram.url = value;
    else settings.events[Number(path[1])].mapUrl = value;
  }
  return settings;
}

export function loadRuntimeConfig(env = process.env) {
  const port = Number(env.APP_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("APP_PORT harus berupa port yang valid");
  const adminKey = env.ADMIN_KEY?.trim() || "";
  if (adminKey.length < 12) throw new Error("ADMIN_KEY wajib diisi minimal 12 karakter");
  return {
    port,
    databasePath: env.DATABASE_PATH?.trim() || "./data/undangan.sqlite",
    adminKey
  };
}
