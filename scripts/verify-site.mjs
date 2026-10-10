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
const sources = new Map(pages.map((page) => [page, readFileSync(resolve(root, page), "utf8")]));

const count = (source, pattern) => (source.match(pattern) || []).length;

for (const page of pages) {
  const html = sources.get(page);

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

  const refs = [...html.matchAll(/(?:src|href)=(["'])(.*?)\1/gi)].map((match) => match[2]);
  for (const ref of refs) {
    if (/^(?:mailto:|tel:|data:)/i.test(ref)) continue;
    let url;
    let cleanRef;
    let fragment;
    try {
      url = new URL(ref.replace(/&amp;/g, "&"), `https://pensiuneacodrut.com/${page}`);
      if (url.origin !== "https://pensiuneacodrut.com") continue;
      cleanRef = decodeURIComponent(url.pathname).replace(/^\//, "");
      fragment = decodeURIComponent(url.hash.slice(1));
    } catch {
      errors.push(`${page}: invalid URL encoding in ${ref}`);
      continue;
    }
    if (!cleanRef) cleanRef = "index.html";
    if (!/\.[a-z0-9]+$/i.test(cleanRef)) cleanRef += ".html";
    const target = resolve(root, cleanRef);
    if (!existsSync(target)) {
      errors.push(`${page}: missing local route or file ${cleanRef}`);
      continue;
    }
    if (fragment && cleanRef.endsWith(".html")) {
      const targetHtml = sources.get(cleanRef) || readFileSync(target, "utf8");
      const ids = new Set([...targetHtml.matchAll(/\sid=(["'])(.*?)\1/gi)].map((match) => match[2]));
      if (!ids.has(fragment)) errors.push(`${page}: missing fragment #${fragment} in ${cleanRef}`);
    }
  }

  if (/<form\b/i.test(html)) errors.push(`${page}: contact must use direct links without a form`);
  if (!/href=(["'])tel:\+40742599860\1/i.test(html)) errors.push(`${page}: missing direct telephone link`);
  if (!/href=(["'])https:\/\/wa\.me\/40742599860(?:\?[^"']*)?\1/i.test(html)) errors.push(`${page}: missing direct WhatsApp link`);
  const mobileActions = html.match(/<(?:div|nav|aside)\b[^>]*class=(["'])[^"']*\bmobile-actions\b[^"']*\1[^>]*>([\s\S]*?)<\/(?:div|nav|aside)>/i)?.[2];
  if (!mobileActions) {
    errors.push(`${page}: missing mobile contact actions`);
  } else {
    if (!/href=(["'])https:\/\/wa\.me\/40742599860(?:\?[^"']*)?\1/i.test(mobileActions)) errors.push(`${page}: mobile WhatsApp must open a direct link`);
    if (!/href=(["'])tel:\+40742599860\1/i.test(mobileActions)) errors.push(`${page}: mobile actions need a direct telephone link`);
  }
  const analyticsScript = html.search(/<script\b[^>]*\bsrc=(["'])\/?analytics\.js(?:\?[^"']*)?\1/i);
  const siteScript = html.search(/<script\b[^>]*\bsrc=(["'])\/?site\.js(?:\?[^"']*)?\1/i);
  if (analyticsScript < 0 || siteScript < analyticsScript) errors.push(`${page}: load analytics.js before site.js`);

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

console.log(`Site verificat: ${pages.length} pagini, JSON-LD valid, resurse și ancore prezente, contact direct fără formulare.`);
