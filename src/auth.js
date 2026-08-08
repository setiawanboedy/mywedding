import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "undangan_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function safeEqual(left, right) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function parseCookies(header = "") {
  return Object.fromEntries((header || "").split(";").map((item) => item.trim().split("=")).filter(([key, value]) => key && value));
}

export function createSessionAuth(adminKey, now = () => Date.now()) {
  const sign = (expiresAt) => createHmac("sha256", adminKey).update(String(expiresAt)).digest("base64url");
  return {
    login: (key) => safeEqual(typeof key === "string" ? key : "", adminKey),
    createToken: () => {
      const expiresAt = Math.floor(now() / 1000) + SESSION_SECONDS;
      return `${expiresAt}.${sign(expiresAt)}`;
    },
    isAuthenticated: (request) => {
      const token = parseCookies(request.headers.get("cookie"))[COOKIE_NAME];
      if (!token) return false;
      const [expiresAtText, signature] = token.split(".");
      const expiresAt = Number(expiresAtText);
      return Number.isInteger(expiresAt) && expiresAt > Math.floor(now() / 1000) && safeEqual(signature || "", sign(expiresAt));
    },
    cookie: (token, request) => {
      const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
      return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
    },
    clearCookie: () => `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  };
}
