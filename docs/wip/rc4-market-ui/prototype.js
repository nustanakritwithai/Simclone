(() => {
  'use strict';

  const inspector = document.getElementById('inspector');
  const toast = document.getElementById('transactionToast');
  const log = document.getElementById('intentLog');
  const marketView = document.getElementById('marketView');
  const merchantView = document.getElementById('merchantView');
  const panelTitle = document.getElementById('panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const panelKicker = document.getElementById('panel-kicker');
  const txSummary = document.getElementById('txSummary');
  const txMeta = document.getElementById('txMeta');

  const frozenSnapshot = Object.freeze({
    markets: Object.freeze({
      'market-mira': Object.freeze({
        marketId:'market-mira', homeId:'home-12', title:"Mira's Goods", owner:'Mira', status:'OPEN',
        stock:17,
        ledger:Object.freeze({revenue:268,cogs:171,profit:97}),
        listings:Object.freeze([
          Object.freeze({listingId:'listing-mira-pickaxe',itemKind:'IRON_PICKAXE',name:'Iron Pickaxe',icon:'⛏',quantity:3,stockAvailable:3,unitPrice:38,revision:1,status:'OPEN'}),
          Object.freeze({listingId:'listing-mira-charcoal',itemKind:'CHARCOAL',name:'Charcoal',icon:'◆',quantity:8,stockAvailable:8,unitPrice:7,revision:1,status:'OPEN'}),
          Object.freeze({listingId:'listing-mira-armor',itemKind:'HIDE_ARMOR',name:'Hide Armor',icon:'🛡',quantity:1,stockAvailable:1,unitPrice:64,revision:1,status:'OPEN'})
        ]),
        buyOffers:Object.freeze([
          Object.freeze({offerId:'offer-mira-ore',name:'Iron Ore',icon:'🪨',quantityWanted:10,unitPrice:6,status:'OPEN'}),
          Object.freeze({offerId:'offer-mira-wood',name:'Wood',icon:'🪵',quantityWanted:20,unitPrice:2,status:'OPEN'})
        ]),
        merchant:Object.freeze({
          profession:'Merchant', transactionCount:19,
          stock:Object.freeze(['⛏ Pickaxe ×3','◆ Charcoal ×8','🛡 Armor ×1','🪓 Axe ×5']),
          goal:'Restock Iron Pickaxe',
          goalEvidence:'Observed local demand > available listing stock.'
        })
      }),
      'market-arin': Object.freeze({
        marketId:'market-arin', homeId:'home-17', title:"Arin's Forge", owner:'Arin', status:'CLOSED',
        stock:4,
        ledger:Object.freeze({revenue:92,cogs:61,profit:31}),
        listings:Object.freeze([
          Object.freeze({listingId:'listing-arin-pickaxe',itemKind:'STONE_PICKAXE',name:'Stone Pickaxe',icon:'⛏',quantity:2,stockAvailable:2,unitPrice:16,revision:1,status:'OPEN'}),
          Object.freeze({listingId:'listing-arin-gear',itemKind:'GEAR_PART',name:'Gear Part',icon:'⚙',quantity:2,stockAvailable:2,unitPrice:9,revision:1,status:'OPEN'})
        ]),
        buyOffers:Object.freeze([]),
        merchant:Object.freeze({
          profession:'Merchant', transactionCount:7,
          stock:Object.freeze(['⛏ Stone Pickaxe ×2','⚙ Gear Part ×2']),
          goal:'Keep shop closed',
          goalEvidence:'Market snapshot is CLOSED; no purchase intent may be emitted.'
        })
      })
    })
  });

  let selectedMarket = frozenSnapshot.markets['market-mira'];

  function escapeHtml(value){
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function unknownMarket(id){
    return Object.freeze({
      marketId: String(id || 'unknown'),
      homeId: 'unknown',
      title: 'Market unavailable',
      owner: 'UNKNOWN',
      status: 'UNKNOWN',
      stock: null,
      ledger: null,
      listings: Object.freeze([]),
      buyOffers: Object.freeze([]),
      merchant: null
    });
  }

  function statusClass(status){
    if(status === 'OPEN') return 'open-pill';
    if(status === 'CLOSED') return 'closed-pill';
    return 'unknown-pill';
  }

  function canPurchase(market, listing){
    return market.status === 'OPEN' &&
      listing.status === 'OPEN' &&
      Number.isSafeInteger(listing.revision) && listing.revision > 0 &&
      Number.isSafeInteger(listing.unitPrice) && listing.unitPrice > 0 &&
      Number.isSafeInteger(listing.stockAvailable) && listing.stockAvailable > 0;
  }

  function renderMetric(label, value, note){
    const shown = value === null || value === undefined ? '—' : escapeHtml(value);
    return `<article><span>${escapeHtml(label)}</span><strong>${shown}</strong><small>${escapeHtml(note)}</small></article>`;
  }

  function renderMarket(){
    const market = selectedMarket;
    const ledger = market.ledger || {};
    const listings = market.listings || [];
    const offers = market.buyOffers || [];

    const listingMarkup = listings.length ? listings.map(listing => {
      const allowed = canPurchase(market, listing);
      const reason = allowed ? `qty ${listing.quantity} · stock ${listing.stockAvailable}` : `qty ${listing.quantity} · stock ${listing.stockAvailable} · unavailable while ${market.status}`;
      return `<button class="listing-card" data-purchase="${escapeHtml(listing.listingId)}" ${allowed ? '' : 'disabled aria-disabled="true"'}>
        <span class="item-icon">${escapeHtml(listing.icon)}</span>
        <span class="item-copy"><b>${escapeHtml(listing.name)}</b><small>${escapeHtml(reason)}</small></span>
        <span class="price">◎ ${escapeHtml(listing.unitPrice)} <small>/ ea</small></span>
      </button>`;
    }).join('') : '<div class="empty-state">No verified listings available.</div>';

    const offerMarkup = offers.length ? offers.map(offer => `<article>
      <span class="item-icon small">${escapeHtml(offer.icon)}</span>
      <span><b>${escapeHtml(offer.name)}</b><small>want ${escapeHtml(offer.quantityWanted)}</small></span>
      <strong>◎ ${escapeHtml(offer.unitPrice)} bid</strong>
    </article>`).join('') : '<div class="empty-state">No verified buy offers.</div>';

    marketView.innerHTML = `
      <div class="status-line">
        <span class="pill ${statusClass(market.status)}">● ${escapeHtml(market.status)}</span>
        <span class="muted">Market ID · ${escapeHtml(market.marketId)}</span>
      </div>
      <div class="metric-grid">
        ${renderMetric('Stock', market.stock, 'canonical item refs')}
        ${renderMetric('Revenue', ledger.revenue == null ? null : '◎ ' + ledger.revenue, 'verified sales')}
        ${renderMetric('COGS', ledger.cogs == null ? null : '◎ ' + ledger.cogs, 'realized only')}
        ${renderMetric('Profit', ledger.profit == null ? null : '◎ ' + ledger.profit, 'revenue − COGS')}
      </div>
      <div class="section-title"><h2>Listings</h2><span>${listings.length} snapshot</span></div>
      <div class="card-list">${listingMarkup}</div>
      <div class="section-title"><h2>Buy offers</h2><span>${offers.length} snapshot</span></div>
      <div class="offer-list">${offerMarkup}</div>
      <div class="authority-note">
        <b>UI authority lock</b>
        <span>Snapshot → display. Tap → command intent. CLOSED/UNKNOWN never emits purchase intent.</span>
      </div>`;
  }

  function renderMerchant(){
    const market = selectedMarket;
    const merchant = market.merchant;
    if(!merchant){
      merchantView.innerHTML = `<div class="empty-state strong">Merchant data UNKNOWN. No profession or ledger state is inferred.</div>`;
      return;
    }
    const ledger = market.ledger || {};
    merchantView.innerHTML = `
      <div class="merchant-hero">
        <div class="portrait">${escapeHtml(market.owner.slice(0,1))}</div>
        <div><span class="eyebrow">PROFESSION</span><h2>${escapeHtml(market.owner)} · ${escapeHtml(merchant.profession)}</h2><p>${escapeHtml(market.homeId)} · Market owner · ${escapeHtml(market.status)}</p></div>
      </div>
      <div class="metric-grid merchant-metrics">
        ${renderMetric('Transactions', merchant.transactionCount, 'verified commits')}
        ${renderMetric('Revenue', ledger.revenue == null ? null : '◎ ' + ledger.revenue, 'ledger snapshot')}
        ${renderMetric('COGS', ledger.cogs == null ? null : '◎ ' + ledger.cogs, 'ledger snapshot')}
        ${renderMetric('Profit', ledger.profit == null ? null : '◎ ' + ledger.profit, 'realized')}
      </div>
      <div class="section-title"><h2>Current stock</h2><span>${market.stock == null ? 'UNKNOWN' : market.stock + ' items'}</span></div>
      <div class="stock-chips">${merchant.stock.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      <div class="goal-card"><span class="goal-icon">◎</span><div><small>CURRENT MERCHANT GOAL</small><b>${escapeHtml(merchant.goal)}</b><p>${escapeHtml(merchant.goalEvidence)}</p></div></div>
      <button class="intent-button" data-market-close ${market.status === 'OPEN' ? '' : 'disabled aria-disabled="true"'}>Request close shop</button>
      <p class="intent-hint">Intent only. Visible status remains unchanged until an authoritative snapshot returns.</p>`;
  }

  function renderSelectedMarket(){
    const market = selectedMarket;
    panelKicker.textContent = 'HOME MARKET';
    panelTitle.textContent = market.title;
    panelSubtitle.textContent = `${market.homeId} · owner ${market.owner} · ${market.status}`;
    renderMarket();
    renderMerchant();
  }

  function setTab(name){
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel-view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
    inspector.classList.remove('hidden');
  }

  function openMarket(id){
    selectedMarket = frozenSnapshot.markets[id] || unknownMarket(id);
    renderSelectedMarket();
    setTab('market');
  }

  function appendLog(type, payload){
    const first = log.querySelector('article');
    if(first && first.textContent.includes('No command')) first.remove();
    const article = document.createElement('article');
    article.innerHTML = `<span class="intent-type">${escapeHtml(type)}</span><p>${escapeHtml(JSON.stringify(payload))}</p>`;
    log.prepend(article);
  }

  function emitIntent(type, extra={}){
    const payload = {type, ...extra, source:'rc4-market-ui-prototype'};
    appendLog(type, payload);
    setTab('intent');
  }

  function acceptTransactionResult(result){
    toast.classList.remove('show');
    const valid = result &&
      result.verificationStatus === 'VERIFIED' &&
      result.commitStatus === 'COMMITTED' &&
      result.duplicate === false &&
      typeof result.transactionId === 'string' && result.transactionId.length > 0 &&
      typeof result.buyerDisplayName === 'string' && result.buyerDisplayName.length > 0 &&
      typeof result.sellerDisplayName === 'string' && result.sellerDisplayName.length > 0 &&
      typeof result.itemDisplayName === 'string' && result.itemDisplayName.length > 0 &&
      Number.isSafeInteger(result.quantity) && result.quantity > 0 &&
      Number.isSafeInteger(result.totalPrice) && result.totalPrice > 0;

    if(!valid){
      appendLog('TRANSACTION_RESULT_REJECTED', {
        verificationStatus:result?.verificationStatus || 'UNKNOWN',
        commitStatus:result?.commitStatus || 'UNKNOWN',
        duplicate:result?.duplicate ?? 'UNKNOWN'
      });
      return false;
    }

    txSummary.textContent = `${result.buyerDisplayName} → ${result.sellerDisplayName} · ${result.itemDisplayName} ×${result.quantity}`;
    txMeta.textContent = `Total ◎ ${result.totalPrice} · transaction ${result.transactionId}`;
    toast.classList.add('show');
    return true;
  }

  document.querySelectorAll('[data-market]').forEach(btn => btn.addEventListener('click', () => openMarket(btn.dataset.market)));
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.open)));

  marketView.addEventListener('click', event => {
    const button = event.target.closest('[data-purchase]');
    if(!button || button.disabled) return;
    const listing = selectedMarket.listings.find(item => item.listingId === button.dataset.purchase);
    if(!listing || !canPurchase(selectedMarket, listing)) return;
    emitIntent('PURCHASE_INTENT', {
      marketId:selectedMarket.marketId,
      listingId:listing.listingId,
      listingRevision:listing.revision,
      itemKind:listing.itemKind,
      quantity:1,
      unitPrice:listing.unitPrice
    });
  });

  merchantView.addEventListener('click', event => {
    const button = event.target.closest('[data-market-close]');
    if(!button || button.disabled || selectedMarket.status !== 'OPEN') return;
    emitIntent('MARKET_CLOSE_INTENT', {marketId:selectedMarket.marketId});
  });

  window.addEventListener('rc4:transaction-result', event => acceptTransactionResult(event.detail));
  document.getElementById('closeInspector').addEventListener('click', () => inspector.classList.add('hidden'));
  document.getElementById('closeToast').addEventListener('click', () => toast.classList.remove('show'));

  window.RC4MarketUI = Object.freeze({acceptTransactionResult});

  renderSelectedMarket();

  const query = new URLSearchParams(location.search);
  if(query.has('market')) openMarket(query.get('market'));
  const view = query.get('view');
  if(view === 'merchant' || view === 'intent' || view === 'market') setTab(view);
  if(query.get('panel') === '0') inspector.classList.add('hidden');
})();
