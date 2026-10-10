(() => {
  'use strict';
  if (document.getElementById('pw-chat')) return;
  const config = window.PW_CHAT_CONFIG || {};
  const apiBase = config.api || 'https://t0pckriwia.execute-api.us-east-2.amazonaws.com';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = 'chat/widget.css'; document.head.append(stylesheet);
  const host = document.createElement('aside'); host.id = 'pw-chat'; host.setAttribute('aria-label', 'Project Worth messages');
  // Static template only. All names, messages and errors use textContent below.
  host.innerHTML = `<button class="pw-emie-peek" type="button" aria-label="Meet EMIE" title="Meet EMIE"><span aria-hidden="true">&#9733;</span></button>
    <button class="pw-chat-launch" type="button" aria-expanded="false" aria-controls="pw-chat-panel"><span class="pw-chat-icon" aria-hidden="true">&#9993;</span><span>Messages</span><span class="pw-chat-count" hidden></span><span class="pw-chat-muted">Muted</span></button>
    <section id="pw-chat-panel" hidden aria-label="Private messages">
      <header class="pw-chat-header"><div><span class="pw-chat-eyebrow">PROJECT WORTH</span><h2>Your people.</h2></div><button class="pw-chat-close" aria-label="Minimize messages" type="button">&#8722;</button></header>
      <div class="pw-chat-login"><span class="pw-login-star" aria-hidden="true">&#9733;</span><h3>A little closer, wherever you are.</h3><p>Sign in to send a private message with your Project Worth account.</p><a href="institute-login.html">Sign in to Project Worth</a></div>
      <div class="pw-chat-workspace" hidden>
        <nav class="pw-chat-tabs" aria-label="Message views"><button type="button" class="pw-chat-tab is-selected" data-view="chat">Chats</button><button type="button" class="pw-chat-tab" data-view="people">Your people</button></nav>
        <div class="pw-chat-people" hidden><p class="pw-chat-section-label">YOUR FIRST FRIEND</p><button type="button" class="pw-chat-person pw-emie-contact"><span class="pw-person-star" aria-hidden="true">&#9733;</span><span><strong>EMIE</strong><small>Your little guiding star</small></span><span class="pw-person-tag">Quiet</span></button><p class="pw-chat-section-label">PRIVATE CONVERSATION</p><button type="button" class="pw-chat-person pw-partner-contact"><span class="pw-partner-avatar"></span><span><strong class="pw-partner-name"></strong><small>Direct message</small></span><span class="pw-person-tag">Private</span></button><p class="pw-chat-directory-note">Your organization’s teams and departments will join this space as member messaging grows.</p></div>
        <section class="pw-chat-thread"><div class="pw-chat-thread-heading"><span class="pw-partner-avatar"></span><div><h3 class="pw-partner-name"></h3><p>Private conversation <span aria-hidden="true">&#183;</span> Muted</p></div></div>
          <button type="button" class="pw-chat-older" hidden>Load earlier messages</button><div class="pw-chat-messages" role="log" aria-live="off" aria-label="Conversation"></div><p class="pw-chat-empty">Say hello. Your conversation starts here.</p>
          <form class="pw-chat-composer"><label class="pw-chat-sr" for="pw-chat-draft">Your message</label><textarea id="pw-chat-draft" rows="2" maxlength="4000" placeholder="Write a private message…" required></textarea><div><small>Just the two of you.</small><button type="submit" class="pw-chat-send">Send <span aria-hidden="true">&#8599;</span></button></div></form>
        </section>
      </div><p class="pw-chat-status" role="status" aria-live="polite"></p>
    </section><section class="pw-emie-note" hidden aria-label="EMIE"><button type="button" class="pw-emie-home" aria-label="Send EMIE home" title="Send EMIE home">&#10022;</button><span class="pw-emie-avatar" aria-hidden="true">&#9733;</span><strong>Hi, I’m EMIE.</strong><p>Your little guiding star. I’m keeping quiet while you catch up. Open <b>Your people</b> to find your conversation.</p><small>My helpful companion adventures are coming later.</small></section>`;
  document.body.append(host);
  const $ = selector => host.querySelector(selector);
  let session = null, pending = null, busy = false, loading = false, cursor = null, received = 0, history = [], open = false, view = 'chat', stopped = false, loadedFirst = false;
  const status = value => { $('.pw-chat-status').textContent = value; };
  const token = () => sessionStorage.getItem('pwInstituteAccessToken');
  function clear() {
    session = null; history = []; received = 0; cursor = null; pending = null; loadedFirst = false;
    $('.pw-chat-messages').replaceChildren(); $('.pw-chat-workspace').hidden = true; $('.pw-chat-login').hidden = false;
    $('.pw-chat-count').hidden = true; $('.pw-chat-older').hidden = true; $('.pw-chat-empty').hidden = false;
    $('#pw-chat-draft').value = '';
  }
  async function api(path, options = {}) {
    const auth = token(); if (!auth) { clear(); throw new Error('Sign in to use private messages.'); }
    const response = await fetch(apiBase + '/api/chat/' + path, { ...options, credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + auth, 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (response.status === 401) { clear(); throw new Error('Your session ended. Sign in again to continue.'); }
    if (response.status === 403) { clear(); throw new Error(data.error || 'Messaging is not enabled for this account.'); }
    if (!response.ok) throw new Error(data.error || 'Messages are temporarily unavailable.');
    return data;
  }
  function render() {
    const box = $('.pw-chat-messages'), nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 70, previous = box.scrollTop;
    box.replaceChildren();
    for (const message of history) {
      const row = document.createElement('article'); row.className = 'pw-chat-message' + (message.name === session.name ? ' is-mine' : '');
      const name = document.createElement('strong'); name.textContent = message.name;
      const body = document.createElement('p'); body.textContent = message.text;
      const time = document.createElement('time'); time.dateTime = message.created; time.textContent = new Date(message.created).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); time.title = new Date(message.created).toLocaleString();
      row.append(name, body, time); box.append(row);
    }
    $('.pw-chat-empty').hidden = history.length > 0;
    $('.pw-chat-older').hidden = !cursor;
    box.scrollTop = nearBottom ? box.scrollHeight : previous;
  }
  async function refresh() {
    if (loading || stopped || !token()) return;
    loading = true;
    try {
      const activeToken = token();
      const data = await api('session');
      if (activeToken !== token()) { clear(); return; }
      session = data; $('.pw-chat-login').hidden = true; $('.pw-chat-workspace').hidden = false;
      host.querySelectorAll('.pw-partner-name').forEach(el => { el.textContent = data.partner; });
      host.querySelectorAll('.pw-partner-avatar').forEach(el => { el.textContent = data.partner.slice(0, 1); });
      $('.pw-chat-count').textContent = String(data.unread); $('.pw-chat-count').hidden = !data.unread;
      $('.pw-chat-launch').setAttribute('aria-label', `Messages, ${data.unread} unread, muted`);
      if (open && view === 'chat' && !document.hidden) {
        const page = await api('messages');
        if (activeToken !== token()) { clear(); return; }
        const all = new Map([...history, ...page.messages].map(m => [m.id, m]));
        history = [...all.values()].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
        if (!loadedFirst) { cursor = page.cursor; loadedFirst = true; }
        received = page.received; render();
        await api('read', { method: 'POST', body: JSON.stringify({ received }) });
        // Only the fetched snapshot is acknowledged; a concurrent new arrival
        // remains unread in DynamoDB and appears on the next poll.
        $('.pw-chat-count').hidden = true;
      }
      status('');
    } catch (e) { status(e.message); }
    finally { loading = false; }
  }
  function toggle(force) {
    open = force ?? !open; $('#pw-chat-panel').hidden = !open;
    $('.pw-chat-launch').setAttribute('aria-expanded', String(open));
    if (open) { refresh(); if (session) $('#pw-chat-draft').focus(); }
    else $('.pw-chat-launch').focus();
  }
  $('.pw-chat-launch').addEventListener('click', () => toggle());
  $('.pw-chat-close').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('.pw-emie-note').hidden = true; if (open) toggle(false); } });
  host.querySelectorAll('.pw-chat-tab').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    host.querySelectorAll('.pw-chat-tab').forEach(tab => tab.classList.toggle('is-selected', tab === button));
    $('.pw-chat-thread').hidden = view !== 'chat'; $('.pw-chat-people').hidden = view !== 'people';
    if (view === 'chat') refresh();
  }));
  $('.pw-partner-contact').addEventListener('click', () => { $('[data-view="chat"]').click(); $('#pw-chat-draft').focus(); });
  const meetEmie = () => { $('.pw-emie-note').hidden = !$('.pw-emie-note').hidden; };
  $('.pw-emie-peek').addEventListener('click', meetEmie); $('.pw-emie-contact').addEventListener('click', meetEmie);
  $('.pw-emie-home').addEventListener('click', () => { $('.pw-emie-note').hidden = true; $('.pw-emie-peek').focus(); });
  $('.pw-chat-composer').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !session) return;
    const draft = $('#pw-chat-draft'), text = draft.value.trim(); if (!text) return;
    if (!pending || pending.text !== text) pending = { text, requestId: crypto.randomUUID() };
    const sent = pending, activeToken = token(); busy = true; $('.pw-chat-send').disabled = true; status('Sending…');
    try {
      const result = await api('messages', { method: 'POST', body: JSON.stringify(sent) });
      if (activeToken !== token() || !session) { clear(); return; }
      history = [...new Map([...history, result.message].map(m => [m.id, m])).values()]; render();
      if (draft.value.trim() === sent.text) draft.value = '';
      pending = null; status('Sent.'); await refresh();
    } catch (e) { status(e.message); }
    finally { busy = false; $('.pw-chat-send').disabled = false; }
  });
  $('.pw-chat-older').addEventListener('click', async () => {
    if (loading || !cursor) return; loading = true;
    try { const page = await api('messages?cursor=' + encodeURIComponent(cursor));
      const box = $('.pw-chat-messages'), previousHeight = box.scrollHeight;
      history = [...new Map([...page.messages, ...history].map(m => [m.id, m])).values()]; cursor = page.cursor; render();
      box.scrollTop += box.scrollHeight - previousHeight;
    } catch (e) { status(e.message); } finally { loading = false; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  document.getElementById('logoutButton')?.addEventListener('click', () => { stopped = true; clear(); });
  const interval = setInterval(() => { if (!document.hidden && token()) refresh(); else if (!token() && session) clear(); }, 5000);
  window.addEventListener('pagehide', () => { clearInterval(interval); clear(); }, { once: true });
  refresh();
})();
