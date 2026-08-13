import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "en.html",
  "atractii.html",
  "ciubar.html",
  "family.html",
  "moieciuvsbran.html",
  "trasee.html",
  "weekend.html",
  "gdpr.html",
  "cazare-moieciu-cu-ciubar.html",
  "cazare-familii-moieciu.html",
  "inchiriere-integrala-pensiune-moieciu.html",
];
const errors = [];

const count = (source, pattern) => (source.match(pattern) || []).length;

for (const page of pages) {
  const file = resolve(root, page);
  const html = readFileSync(file, "utf8");

  for (const [label, pattern] of [
    ["<head>", /<head(?:\s[^>]*)?>/gi],
    ["<body>", /<body(?:\s[^>]*)?>/gi],
    ["<h1>", /<h1(?:\s[^>]*)?>/gi],
    ["canonical", /<link\s[^>]*rel=["']canonical["'][^>]*>/gi],
  ]) {
    const matches = count(html, pattern);
    if (matches !== 1) errors.push(`${page}: expected one ${label}, found ${matches}`);
  }

  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of jsonLdBlocks) {
    try {
      JSON.parse(rawJson);
    } catch (error) {
      errors.push(`${page}: invalid JSON-LD (${error.message})`);
    }
  }

  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(ref)) continue;
    let cleanRef = ref.split("?")[0].split("#")[0];
    if (!cleanRef) continue;
    try {
      cleanRef = decodeURIComponent(cleanRef);
    } catch {
      errors.push(`${page}: invalid URL encoding in ${ref}`);
      continue;
    }
    cleanRef = cleanRef.startsWith("/") ? cleanRef.slice(1) : cleanRef;
    if (!cleanRef) cleanRef = "index.html";
    if (!/\.[a-z0-9]+$/i.test(cleanRef)) cleanRef += ".html";
    if (!existsSync(resolve(root, cleanRef))) errors.push(`${page}: missing local route or file ${cleanRef}`);
  }

  for (const forbidden of ["cdn.tailwindcss.com", "images.unsplash.com", "munti.webp", 'href="#"']) {
    if (html.includes(forbidden)) errors.push(`${page}: forbidden reference ${forbidden}`);
  }
}

for (const localizedHome of ["index.html", "en.html"]) {
  const html = readFileSync(resolve(root, localizedHome), "utf8");
  for (const hreflang of ["ro-RO", "en", "x-default"]) {
    const pattern = new RegExp(`<link\\s+[^>]*rel=["']alternate["'][^>]*hreflang=["']${hreflang}["'][^>]*>`, "i");
    if (!pattern.test(html)) errors.push(`${localizedHome}: missing hreflang ${hreflang}`);
  }
}

const sitemap = readFileSync(resolve(root, "sitemap.xml"), "utf8");
if (count(sitemap, /<loc>/g) !== 11) errors.push("sitemap.xml: expected 11 canonical URLs");
if (sitemap.includes(".html")) errors.push("sitemap.xml: .html URLs are not canonical");
if (!sitemap.includes("<loc>https://pensiuneacodrut.com/en</loc>")) errors.push("sitemap.xml: missing English landing page");
for (const commercialUrl of [
  "https://pensiuneacodrut.com/cazare-moieciu-cu-ciubar",
  "https://pensiuneacodrut.com/cazare-familii-moieciu",
  "https://pensiuneacodrut.com/inchiriere-integrala-pensiune-moieciu",
]) {
  if (!sitemap.includes(`<loc>${commercialUrl}</loc>`)) errors.push(`sitemap.xml: missing ${commercialUrl}`);
}

const redirects = readFileSync(resolve(root, "_redirects"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith("#"));
if (redirects.length !== 12) errors.push(`_redirects: expected 12 redirects, found ${redirects.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Site verificat: ${pages.length} pagini, JSON-LD valid, resurse locale prezente.`);
