const requiredKeys = [
  "GROOM_NAME",
  "GROOM_SHORT_NAME",
  "GROOM_INSTAGRAM_HANDLE",
  "GROOM_INSTAGRAM_URL",
  "BRIDE_NAME",
  "BRIDE_SHORT_NAME",
  "BRIDE_INSTAGRAM_HANDLE",
  "BRIDE_INSTAGRAM_URL",
  "COUNTDOWN_TARGET",
  "AKAD_DATE",
  "AKAD_TIME",
  "AKAD_VENUE",
  "AKAD_ADDRESS",
  "AKAD_MAP_URL",
  "RECEPTION_DATE",
  "RECEPTION_TIME",
  "RECEPTION_VENUE",
  "RECEPTION_ADDRESS",
  "RECEPTION_MAP_URL",
  "BANK_1_NAME",
  "BANK_1_ACCOUNT_NUMBER",
  "BANK_1_ACCOUNT_HOLDER",
  "BANK_2_NAME",
  "BANK_2_ACCOUNT_NUMBER",
  "BANK_2_ACCOUNT_HOLDER"
];

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Environment variable ${key} wajib diisi`);
  return value;
}

function validUrl(value, key) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return value;
  } catch {
    throw new Error(`Environment variable ${key} harus berupa URL http/https yang valid`);
  }
}

export function loadConfig(env = process.env) {
  const values = Object.fromEntries(requiredKeys.map((key) => [key, required(env, key)]));
  const targetTime = Date.parse(values.COUNTDOWN_TARGET);
  if (Number.isNaN(targetTime) || !/[+-]\d{2}:\d{2}$|Z$/.test(values.COUNTDOWN_TARGET)) {
    throw new Error("Environment variable COUNTDOWN_TARGET harus berupa ISO 8601 dengan zona waktu");
  }
  for (const key of ["AKAD_DATE", "RECEPTION_DATE"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values[key]) || Number.isNaN(Date.parse(`${values[key]}T00:00:00Z`))) {
      throw new Error(`Environment variable ${key} harus memakai format YYYY-MM-DD`);
    }
  }

  const port = Number(env.APP_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Environment variable APP_PORT harus berupa port yang valid");
  }

  return {
    port,
    databasePath: env.DATABASE_PATH?.trim() || "./data/undangan.sqlite",
    public: {
      couple: {
        groom: {
          name: values.GROOM_NAME,
          shortName: values.GROOM_SHORT_NAME,
          instagram: { handle: values.GROOM_INSTAGRAM_HANDLE, url: validUrl(values.GROOM_INSTAGRAM_URL, "GROOM_INSTAGRAM_URL") }
        },
        bride: {
          name: values.BRIDE_NAME,
          shortName: values.BRIDE_SHORT_NAME,
          instagram: { handle: values.BRIDE_INSTAGRAM_HANDLE, url: validUrl(values.BRIDE_INSTAGRAM_URL, "BRIDE_INSTAGRAM_URL") }
        }
      },
      wedding: { countdownTarget: values.COUNTDOWN_TARGET },
      events: [
        { type: "Akad Nikah", date: values.AKAD_DATE, time: values.AKAD_TIME, venue: values.AKAD_VENUE, address: values.AKAD_ADDRESS, mapUrl: validUrl(values.AKAD_MAP_URL, "AKAD_MAP_URL") },
        { type: "Resepsi", date: values.RECEPTION_DATE, time: values.RECEPTION_TIME, venue: values.RECEPTION_VENUE, address: values.RECEPTION_ADDRESS, mapUrl: validUrl(values.RECEPTION_MAP_URL, "RECEPTION_MAP_URL") }
      ],
      accounts: [
        { bank: values.BANK_1_NAME, number: values.BANK_1_ACCOUNT_NUMBER, holder: values.BANK_1_ACCOUNT_HOLDER },
        { bank: values.BANK_2_NAME, number: values.BANK_2_ACCOUNT_NUMBER, holder: values.BANK_2_ACCOUNT_HOLDER }
      ]
    }
  };
}
