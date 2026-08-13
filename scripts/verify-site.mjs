import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "atractii.html",
  "ciubar.html",
  "family.html",
  "moieciuvsbran.html",
  "trasee.html",
  "weekend.html",
  "gdpr.html",
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
    if (/^(?:https?:|mailto:|tel:|#|data:|\/)/i.test(ref)) continue;
    const cleanRef = ref.split("?")[0].split("#")[0];
    if (!cleanRef || !/\.[a-z0-9]+$/i.test(cleanRef)) continue;
    if (!existsSync(resolve(root, cleanRef))) errors.push(`${page}: missing local file ${cleanRef}`);
  }

  for (const forbidden of ["cdn.tailwindcss.com", "images.unsplash.com", "munti.webp", 'href="#"']) {
    if (html.includes(forbidden)) errors.push(`${page}: forbidden reference ${forbidden}`);
  }
}

const sitemap = readFileSync(resolve(root, "sitemap.xml"), "utf8");
if (count(sitemap, /<loc>/g) !== 7) errors.push("sitemap.xml: expected 7 canonical URLs");
if (sitemap.includes(".html")) errors.push("sitemap.xml: .html URLs are not canonical");

const redirects = readFileSync(resolve(root, "_redirects"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith("#"));
if (redirects.length !== 7) errors.push(`_redirects: expected 7 redirects, found ${redirects.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Site verificat: ${pages.length} pagini, JSON-LD valid, resurse locale prezente.`);
