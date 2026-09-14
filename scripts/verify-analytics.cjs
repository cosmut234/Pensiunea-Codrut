// Run with Playwright available via NODE_PATH or a local installation.
// External requests are intercepted so these tests never enter production reports.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, extname } = require('node:path');

(async () => {
  const root = resolve(__dirname, '..');
  const server = createServer((req, res) => {
    let path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') path = '/index.html';
    if (!extname(path)) path += '.html';
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tagRequests = [];
    const collections = [];
    const errors = [];
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (url.includes('googletagmanager.com/gtag/js')) {
        tagRequests.push(url);
        if (process.env.ANALYTICS_REAL_TAG) return route.continue();
        return route.fulfill({ contentType: 'text/javascript', body: '' });
      }
      if (url.includes('google-analytics.com/') && url.includes('collect')) {
        collections.push(url + '&' + (route.request().postData() || ''));
        return route.fulfill({ status: 204, body: '' });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    assert.equal(await page.locator('[data-cookie-banner]').count(), 1, 'Visitors must be able to accept or refuse analytics');
    assert.equal(tagRequests.length, 0, 'No Google tag before consent');
    await page.locator('[data-cookie-reject]').click();
    await page.reload();
    assert.equal(tagRequests.length, 0, 'Refusal must survive reload without loading Google');
    assert.equal(await page.locator('[data-cookie-banner]').isVisible(), false);
    await page.locator('[data-cookie-settings]').click();
    await page.locator('[data-cookie-accept]').click();
    await page.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'config'));
    assert.equal(tagRequests.length, 1, 'One Google tag after acceptance');
    const commands = await page.evaluate(() => window.dataLayer.map(entry => Array.from(entry)));
    const config = commands.find(entry => entry[0] === 'config');
    assert.equal(config[1], 'G-WFJ6KDGGWN');
    assert.equal(config[2].allow_google_signals, false);
    assert.equal(commands.find(entry => entry[0] === 'consent' && entry[1] === 'default')[2].analytics_storage, 'denied');
    assert.equal(commands.find(entry => entry[0] === 'consent' && entry[1] === 'update')[2].analytics_storage, 'granted');
    if (process.env.ANALYTICS_REAL_TAG) {
      await page.waitForFunction(() => window.google_tag_manager, { timeout: 20000 });
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 15000;
        const check = () => {
          if (collections.some(request => request.includes('en=page_view') && request.includes('tid=G-WFJ6KDGGWN'))) return resolve();
          if (Date.now() > deadline) return reject(new Error('Google tag did not issue a page_view for the supplied ID'));
          setTimeout(check, 100);
        };
        check();
      });
    }
    // Suppress navigation, but dispatch real bubbling clicks to the site's handler.
    await page.evaluate(() => {
      for (const href of ['https://wa.me/40742599860?text=PRIVATE_MESSAGE', 'tel:+40742599860']) {
        const link = document.createElement('a');
        link.href = href; link.textContent = 'PRIVATE_LABEL';
        link.addEventListener('click', event => event.preventDefault());
        document.body.append(link); link.click(); link.remove();
      }
    });
    const events = await page.evaluate(() => window.dataLayer.filter(entry => entry[0] === 'event').map(entry => Array.from(entry)));
    assert(events.some(entry => entry[1] === 'click_whatsapp'));
    assert(events.some(entry => entry[1] === 'click_phone'));
    assert(!JSON.stringify(events).includes('PRIVATE_'), 'Contact text and message URLs must not be sent');
    await page.evaluate(() => {
      window.open = () => null;
      const form = document.querySelector('[data-availability-form]');
      const year = new Date().getFullYear() + 1;
      form.elements.arrival.value = `${year}-10-10`;
      form.elements.departure.value = `${year}-10-12`;
      form.elements.stayType.selectedIndex = 1;
      form.requestSubmit();
    });
    const submission = await page.evaluate(() => {
      const command = window.dataLayer.find(entry => entry[0] === 'event' && entry[1] === 'submit_availability');
      return command ? command[2] : null;
    });
    assert(submission, 'Valid availability request produces a contact event');
    assert(!JSON.stringify(submission).includes('-10-'), 'Stay dates must not be sent to analytics');
    if (process.env.ANALYTICS_REAL_TAG) {
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 15000;
        const check = () => {
          if (['click_whatsapp', 'click_phone', 'submit_availability'].every(name => collections.some(request => request.includes(`en=${name}`)))) return resolve();
          if (Date.now() > deadline) return reject(new Error('Google tag did not dispatch all three contact events'));
          setTimeout(check, 100);
        };
        check();
      });
    }
    await page.reload();
    await page.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'config'));
    assert.equal(tagRequests.length, 2, 'Consent survives reload');
    await context.addCookies([{ name: '_ga', value: 'test', url: base }, { name: '_ga_WFJ6KDGGWN', value: 'test', url: base }]);
    await page.locator('[data-cookie-settings]').click();
    await Promise.all([page.waitForNavigation(), page.locator('[data-cookie-reject]').click()]);
    assert.equal(tagRequests.length, 2, 'Withdrawal must unload and block Google');
    assert(!(await context.cookies()).some(cookie => cookie.name.startsWith('_ga')), 'Withdrawal deletes analytics cookies');
    for (const path of ['/', '/en', '/gdpr', '/atractii', '/ciubar', '/family', '/moieciuvsbran', '/trasee', '/weekend', '/cazare-moieciu-cu-ciubar', '/cazare-familii-moieciu', '/inchiriere-integrala-pensiune-moieciu']) {
      await page.goto(base + path);
      assert.equal(await page.locator('[data-cookie-settings]').count(), 1, `Settings available on ${path}`);
    }
    await page.goto(base + '/en');
    await page.locator('[data-cookie-settings]').click();
    assert.equal(await page.locator('[data-cookie-accept]').innerText(), 'Accept');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const baselineWidth = await page.evaluate(() => {
        const banner = document.querySelector('[data-cookie-banner]');
        banner.hidden = true;
        const width = document.documentElement.scrollWidth;
        banner.hidden = false;
        return width;
      });
      if (process.env.ANALYTICS_SCREENSHOTS) {
        await page.screenshot({ path: resolve(process.env.ANALYTICS_SCREENSHOTS, `analytics-${width}.png`) });
      }
      assert(await page.evaluate(baseline => document.documentElement.scrollWidth <= baseline, baselineWidth), `Banner must not add overflow at ${width}px`);
      const box = await page.locator('[data-cookie-banner]').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 844);
    }
    assert.deepEqual(errors, []);
    assert.equal(tagRequests.length, 2, 'Declined pages never load Google');
    await page.evaluate(() => {
      localStorage.setItem('codrut.analytics-consent.v1', JSON.stringify({ value: 'granted', expires: 1 }));
      document.cookie = 'codrut_analytics_consent=; Max-Age=0; Path=/; SameSite=Lax';
    });
    await page.reload();
    assert.equal(await page.locator('[data-cookie-banner]').isVisible(), true, 'Expired consent must ask again');
    assert.equal(tagRequests.length, 2, 'Expired consent cannot load Google');
    await page.addInitScript(() => {
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.__blockStorageWrites) throw new Error('Storage unavailable');
        return nativeSetItem.call(this, key, value);
      };
      window.__blockStorageWrites = true;
    });
    await page.reload();
    await page.locator('[data-cookie-accept]').click();
    await page.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'config'));
    assert.equal(tagRequests.length, 3, 'Consent works for this page when persistence is unavailable');
    await page.reload();
    assert.equal(await page.locator('[data-cookie-banner]').isVisible(), false, 'The essential preference cookie preserves consent when local storage is unavailable');
    assert.equal(tagRequests.length, 4);
    // Simulate a previously saved grant followed by a browser that can no
    // longer write the preference while the visitor withdraws consent.
    await page.evaluate(() => {
      window.__blockStorageWrites = false;
      localStorage.setItem('codrut.analytics-consent.v1', JSON.stringify({ value: 'granted', expires: Date.now() + 60_000 }));
      window.__blockStorageWrites = true;
    });
    await page.reload();
    await page.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'config'));
    assert.equal(tagRequests.length, 5, 'Stored consent enables analytics before withdrawal');
    await page.locator('[data-cookie-settings]').click();
    await Promise.all([page.waitForNavigation(), page.locator('[data-cookie-reject]').click()]);
    assert.equal(tagRequests.length, 5, 'A stale granted preference must not load Google after withdrawal');
    assert.equal((await context.cookies()).find(cookie => cookie.name === 'codrut_analytics_consent')?.value, 'denied', 'Withdrawal is saved in the essential preference cookie');
    assert.equal(await page.locator('[data-cookie-banner]').isVisible(), false, 'Saved refusal keeps the banner closed');
    console.log('Analytics verified: consent, refusal, reload, withdrawal, cookies, contact events, 12 pages, RO/EN and mobile/desktop.');
    if (process.env.ANALYTICS_REAL_TAG) console.log(`Real Google tag verified; ${collections.length} collection requests intercepted, none sent to reports.`);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
