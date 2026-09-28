(() => {
  'use strict';
  const inspector = document.getElementById('inspector');
  const toast = document.getElementById('transactionToast');
  const log = document.getElementById('intentLog');
  const panelTitle = document.getElementById('panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const panelKicker = document.getElementById('panel-kicker');

  const frozenSnapshot = Object.freeze({
    markets: Object.freeze({
      'market-mira': Object.freeze({ marketId:'market-mira', homeId:'home-12', owner:'Mira', status:'OPEN' }),
      'market-arin': Object.freeze({ marketId:'market-arin', homeId:'home-17', owner:'Arin', status:'CLOSED' })
    })
  });

  function setTab(name){
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel-view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
    inspector.classList.remove('hidden');
  }

  function openMarket(id){
    const market = frozenSnapshot.markets[id] || frozenSnapshot.markets['market-mira'];
    panelKicker.textContent = 'HOME MARKET';
    panelTitle.textContent = market.owner === 'Mira' ? "Mira's Goods" : "Arin's Forge";
    panelSubtitle.textContent = `${market.homeId.replace('-', ' ')} · owner ${market.owner} · ${market.status}`;
    setTab('market');
  }

  function emitIntent(type, extra={}){
    const payload = { type, ...extra, source:'rc4-market-ui-prototype' };
    const first = log.querySelector('article');
    if(first && first.textContent.includes('No command')) first.remove();
    const article = document.createElement('article');
    article.innerHTML = `<span class="intent-type">${type}</span><p>${escapeHtml(JSON.stringify(payload))}</p>`;
    log.prepend(article);
    setTab('intent');
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  document.querySelectorAll('[data-market]').forEach(btn => btn.addEventListener('click', () => openMarket(btn.dataset.market)));
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.open)));
  document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => emitIntent(btn.dataset.intent, {itemKind:btn.dataset.item || null, unitPrice:Number(btn.dataset.price || 0) || null})));
  document.querySelectorAll('[data-demo="transaction"]').forEach(btn => btn.addEventListener('click', () => toast.classList.add('show')));
  document.getElementById('closeInspector').addEventListener('click', () => inspector.classList.add('hidden'));
  document.getElementById('closeToast').addEventListener('click', () => toast.classList.remove('show'));

  const query = new URLSearchParams(location.search);
  const view = query.get('view');
  if(view === 'merchant') setTab('merchant');
  if(view === 'intent') setTab('intent');
  if(view === 'closed') openMarket('market-arin');
  if(query.get('tx') === '1') toast.classList.add('show');
  if(query.get('panel') === '0') inspector.classList.add('hidden');
})();
