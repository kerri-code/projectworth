'use strict';
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = resolve(__dirname, '..'), output = resolve(root, 'test-results'); mkdirSync(output, { recursive: true });
  const server = createServer((req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><title>Project Worth chat test</title><style>body{background:#fcf5e6;font:18px Arial;color:#10273c;padding:50px}h1{font-size:48px;max-width:600px}p{max-width:600px}</style><h1>Change starts here.</h1><p>Project Worth member messaging test fixture.</p><button id="logoutButton">Log out</button><script src="chat/widget.js"></script>'); return; }
    const file = new Map([['/chat/widget.js', ['widget.js', 'text/javascript']], ['/chat/widget.css', ['widget.css', 'text/css']]]).get(req.url);
    if (!file) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', file[1] + '; charset=utf-8'); res.end(readFileSync(resolve(root, file[0])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = process.env.PW_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ ...(existsSync(chrome) ? { executablePath: chrome } : {}), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let messages = [{ id: 'hello', name: 'Kerri', text: 'Hey! Glad we have our own little corner.', created: '2026-10-10T05:00:00.000Z' }], posted = [], failSend = false, read = false;
    await page.route('https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/chat/**', async route => {
      const path = new URL(route.request().url()).pathname, method = route.request().method();
      assert.equal(route.request().headers().authorization, 'Bearer synthetic-test-token');
      let data;
      if (path.endsWith('/session')) data = { name: 'Zac', partner: 'Kerri', unread: read ? 0 : 1 };
      else if (path.endsWith('/read')) { read = true; data = { ok: true }; }
      else if (method === 'GET') data = { messages, cursor: null, received: 1 };
      else { const body = route.request().postDataJSON(); posted.push(body);
        if (failSend) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Please retry.' }) }); return; }
        const existing = messages.find(m => m.id === body.requestId), message = existing || { id: body.requestId, name: 'Zac', text: body.text, created: new Date().toISOString() };
        if (!existing) messages.push(message); data = { message };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base); await page.locator('.pw-chat-launch').click();
    assert.equal(await page.locator('.pw-chat-login a').getAttribute('href'), 'institute-login.html');
    await page.evaluate(() => sessionStorage.setItem('pwInstituteAccessToken', 'synthetic-test-token'));
    await page.reload(); await page.locator('.pw-chat-count:not([hidden])').waitFor();
    assert.equal(await page.locator('#pw-chat-panel').isVisible(), false);
    assert.equal(await page.locator('.pw-emie-note').isVisible(), false);
    await page.locator('.pw-chat-launch').click(); await page.locator('.pw-chat-message').waitFor();
    assert.equal(await page.locator('.pw-partner-name').first().textContent(), 'Kerri');
    await page.locator('#pw-chat-draft').fill('<img src=x onerror=alert(1)>'); failSend = true;
    await page.locator('.pw-chat-send').click(); await page.getByText('Please retry.').waitFor();
    assert.equal(await page.locator('#pw-chat-draft').inputValue(), '<img src=x onerror=alert(1)>');
    failSend = false; await page.locator('.pw-chat-send').click(); await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
    assert.equal(posted[0].requestId, posted[1].requestId);
    assert.equal(await page.locator('.pw-chat-messages img').count(), 0);
    assert.equal(await page.locator('#pw-chat-draft').inputValue(), '');
    await page.screenshot({ path: resolve(output, 'desktop.png') });
    await page.locator('[data-view="people"]').click(); await page.locator('.pw-emie-contact').click();
    await page.locator('.pw-emie-note:not([hidden])').waitFor(); await page.locator('.pw-emie-home').click();
    assert.equal(await page.locator('.pw-emie-note').isVisible(), false);
    await page.locator('.pw-partner-contact').click(); await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bounds = await page.locator('#pw-chat-panel').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0);
    await page.screenshot({ path: resolve(output, 'mobile.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#pw-chat-panel').isVisible(), false);
    await page.locator('#logoutButton').click(); assert.equal(await page.locator('.pw-chat-message').count(), 0);
    assert.deepEqual(errors, []);
    console.log('E2E passed: sign-in link, muted unread badge, private thread, retry/draft preservation, inert markup, EMIE dismissal, mobile layout, Escape and logout clearing. API mocked; no real-account messages sent.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
