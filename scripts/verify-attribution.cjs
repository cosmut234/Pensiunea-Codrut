// Run with Playwright on NODE_PATH; ANALYTICS_REAL_TAG=1 also checks emitted payloads.
// Every collection request is intercepted before navigation and never forwarded.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const measurementId = 'G-WFJ6KDGGWN';
const campaign = 'profil-2026-10';
const cases = [
  { name: 'Instagram campaign', query: `utm_source=instagram&utm_medium=social&utm_campaign=${campaign}&message=PRIVATE_MESSAGE&phone=PRIVATE_PHONE`, source: 'instagram' },
  { name: 'Facebook campaign', query: `utm_source=facebook&utm_medium=social&utm_campaign=${campaign}`, source: 'facebook' },
  { name: 'Unknown source', query: `utm_source=other&utm_medium=social&utm_campaign=${campaign}` },
  { name: 'Wrong medium', query: `utm_source=instagram&utm_medium=cpc&utm_campaign=${campaign}` },
  { name: 'Unknown campaign', query: 'utm_source=instagram&utm_medium=social&utm_campaign=PRIVATE_CAMPAIGN' },
  { name: 'Missing campaign', query: 'utm_source=instagram&utm_medium=social' },
  { name: 'Duplicate source', query: `utm_source=instagram&utm_source=instagram&utm_medium=social&utm_campaign=${campaign}` },
  { name: 'Duplicate medium', query: `utm_source=instagram&utm_medium=social&utm_medium=social&utm_campaign=${campaign}` },
  { name: 'Duplicate campaign', query: `utm_source=instagram&utm_medium=social&utm_campaign=${campaign}&utm_campaign=${campaign}` },
  { name: 'Empty query', query: '' },
  { name: 'Contact referrer path', query: '', referrer: 'https://wa.me/PRIVATE_PHONE?text=PRIVATE_MESSAGE#PRIVATE_FRAGMENT', referrerOrigin: 'https://wa.me/' },
  { name: 'Invalid referrer', query: '', referrer: 'not-a-url', referrerOrigin: '' },
  { name: 'Non-HTTP referrer', query: '', referrer: 'mailto:PRIVATE_EMAIL@example.invalid', referrerOrigin: '' },
];

(async () => {
  const source = readFileSync(resolve(__dirname, '../analytics.js'));
  const fixture = '<!doctype html><html lang="ro"><head><meta charset="utf-8"><script defer src="/analytics.js"></script></head><body><h1>Local attribution test</h1><footer></footer></body></html>';
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (path === '/analytics.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(source); }
    else if (path === '/test') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); }
    else res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let totalCollections = 0;
  const scriptCache = new Map();
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const test of cases) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const payloads = [];
      const errors = [];
      let tags = 0;
      await context.addInitScript(referrer => Object.defineProperty(document, 'referrer', { get: () => referrer }),
        test.referrer ?? 'https://www.google.com/search?q=PRIVATE_SEARCH#PRIVATE_FRAGMENT');
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === base) return route.continue();
        const isTag = url.hostname === 'www.googletagmanager.com' && ['/gtag/js', '/gtag/destination'].includes(url.pathname)
          && request.method() === 'GET' && url.searchParams.get('id') === measurementId;
        if (isTag) {
          tags++;
          if (!process.env.ANALYTICS_REAL_TAG) return route.fulfill({ contentType: 'text/javascript', body: '' });
          if (!scriptCache.has(url.href)) {
            const response = await route.fetch({ maxRedirects: 0, headers: { ...request.headers(), referer: base + '/' } });
            assert.equal(response.status(), 200, 'Official tag script must return HTTP 200');
            scriptCache.set(url.href, await response.body());
          }
          return route.fulfill({ contentType: 'text/javascript', body: scriptCache.get(url.href) });
        }
        if (url.pathname.endsWith('/collect')) {
          const common = Object.fromEntries(url.searchParams);
          for (const line of (request.postData() || '').split(/\r?\n/)) {
            payloads.push({ ...common, ...Object.fromEntries(new URLSearchParams(line)) });
          }
          totalCollections++;
          return route.fulfill({ status: 204, body: '' });
        }
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`${base}/test?${test.query}#PRIVATE_FRAGMENT`);
        assert.equal(tags, 0, `${test.name}: no tag before consent`);
        await page.locator('[data-cookie-accept]').click();
        await page.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'config'));
        const config = await page.evaluate(() => window.dataLayer.find(entry => entry[0] === 'config')[2]);
        assert.equal(config.page_location, base + '/test', `${test.name}: page URL must omit query and fragment`);
        assert.equal(config.page_referrer, test.referrerOrigin ?? 'https://www.google.com/', `${test.name}: referrer must omit path/query/fragment`);
        if (test.source) {
          assert.equal(config.campaign_source, test.source, `${test.name}: approved source must be forwarded`);
          assert.equal(config.campaign_medium, 'social');
          assert.equal(config.campaign_name, campaign);
        } else {
          for (const key of ['campaign_source', 'campaign_medium', 'campaign_name']) assert.equal(config[key], undefined, `${test.name}: no free campaign values`);
        }
        assert(!JSON.stringify(config).includes('PRIVATE_'), `${test.name}: config must not contain synthetic private markers`);
        if (process.env.ANALYTICS_REAL_TAG) {
          await assert.doesNotReject(async () => {
            const deadline = Date.now() + 20000;
            while (!payloads.some(row => row.en === 'page_view' && row.tid === measurementId)) {
              assert(Date.now() < deadline, `${test.name}: missing real page_view`);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          });
          const row = payloads.find(row => row.en === 'page_view' && row.tid === measurementId);
          assert.equal(row.dl, base + '/test');
          assert.equal(row.dr || '', test.referrerOrigin ?? 'https://www.google.com/');
          assert.equal(row.cs, test.source);
          assert.equal(row.cm, test.source ? 'social' : undefined);
          assert.equal(row.cn, test.source ? campaign : undefined);
          assert(!JSON.stringify(payloads).includes('PRIVATE_'), `${test.name}: collection must not contain synthetic private markers`);
        }
        assert.deepEqual(errors, [], `${test.name}: no browser script errors`);
      } finally { await context.close(); }
    }
    console.log(`Attribution verified: ${cases.length} cases; ${totalCollections} collection requests intercepted, none forwarded; ${process.env.ANALYTICS_REAL_TAG ? 'real tag payloads' : 'local config commands'} checked.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
