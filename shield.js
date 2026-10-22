// Bloqueia baixadores de site (HTTrack, wget, curl...) e acesso direto a .js/.css fora do navegador.
const BAD_UA = /(httrack|webcopier|webzip|teleport|offline ?explorer|sitesucker|webreaper|websauger|webstripper|blackwidow|cyotek|wget|curl|libwww|python-requests|python-urllib|aiohttp|scrapy|go-http-client|java\/|okhttp|axios|node-fetch|headless|phantomjs|selenium|puppeteer|playwright|httpclient|powershell|postman|insomnia|httpie)/i;
const OK_DEST = { js: ["script", "worker", "serviceworker", "sharedworker"], css: ["style"] };

export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  const deny = () => new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  if (!ua || BAD_UA.test(ua)) return deny();

  const m = url.pathname.match(/\.(js|css)$/);
  if (m) {
    const dest = request.headers.get("sec-fetch-dest");
    if (!OK_DEST[m[1]].includes(dest)) return deny();
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return deny();
  }
  return context.next();
};
export const config = { path: "/*" };
