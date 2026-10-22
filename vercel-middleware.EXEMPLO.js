// VERCEL: se você NÃO tem middleware.js, renomeie este arquivo para middleware.js (na raiz do repo).
// Se já tem, copie só o conteúdo da função shield() para dentro do seu.
const BAD_UA = /(httrack|webcopier|webzip|teleport|offline ?explorer|sitesucker|webreaper|websauger|webstripper|blackwidow|cyotek|wget|curl|libwww|python-requests|python-urllib|aiohttp|scrapy|go-http-client|java\/|okhttp|axios|node-fetch|headless|phantomjs|selenium|puppeteer|playwright|httpclient|powershell|postman|insomnia|httpie)/i;
const OK_DEST = { js: ["script", "worker", "serviceworker", "sharedworker"], css: ["style"] };

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  const deny = () => new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  if (!ua || BAD_UA.test(ua)) return deny();
  const m = new URL(request.url).pathname.match(/\.(js|css)$/);
  if (m) {
    if (!OK_DEST[m[1]].includes(request.headers.get("sec-fetch-dest"))) return deny();
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return deny();
  }
}
export const config = { matcher: "/((?!_next).*)" };
