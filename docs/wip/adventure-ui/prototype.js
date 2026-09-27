const FIXTURE_URL = "./fixtures/adventure-ui-fixture.json";

const sheet = document.querySelector("#sheet");
const sheetTitle = document.querySelector("#sheet-title");
const sheetKicker = document.querySelector("#sheet-kicker");
const sheetContent = document.querySelector("#sheet-content");
const toast = document.querySelector("#toast");

let fixture = null;
let toastTimer = null;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const pct = (current, max) => max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function setMeter(id, value) {
  document.querySelector(id).style.width = value + "%";
}

function renderWorld() {
  const a = fixture.adventurer;
  document.querySelector("#clone-name").textContent = a.name;
  document.querySelector("#profession").textContent = a.profession;
  document.querySelector("#clone-level").textContent = a.level;

  document.querySelector("#hp-label").textContent = a.hp.current + "/" + a.hp.max;
  document.querySelector("#exp-label").textContent = a.exp.current + "/" + a.exp.nextLevel;
  setMeter("#hp-meter", pct(a.hp.current, a.hp.max));
  setMeter("#exp-meter", pct(a.exp.current, a.exp.nextLevel));

  document.querySelector("#skill-1").textContent = fixture.hud.skills[0].label;
  document.querySelector("#skill-2").textContent = fixture.hud.skills[1].label;
  document.querySelector("#skill-3").textContent = fixture.hud.skills[2].label;

  document.querySelector("#expedition-title").textContent = a.currentExpedition.label;
  document.querySelector("#expedition-detail").textContent =
    a.currentExpedition.objective + " · " + a.currentExpedition.progressLabel;
  document.querySelector("#marker-label").textContent =
    fixture.encounter.monster.name + " · Lv." + fixture.encounter.monster.level;
}

function statCells(stats) {
  return ["ATK", "DEF", "SPATK", "SPDEF", "SPD"].map((key) =>
    '<div class="stat"><span>' + key + '</span><strong>' + esc(stats[key]) + '</strong></div>'
  ).join("");
}

function renderInspector() {
  const a = fixture.adventurer;
  const known = fixture.regions.filter((r) => a.knownZones.includes(r.zoneId));
  return `
    <section class="card">
      <div class="key-value">
        <div><span>Profession</span><strong>${esc(a.profession)}</strong></div>
        <div><span>Specialization</span><strong>${esc(a.specialization)}</strong></div>
        <div><span>Level</span><strong>${esc(a.level)}</strong></div>
        <div><span>EXP</span><strong>${esc(a.exp.current)} / ${esc(a.exp.nextLevel)}</strong></div>
        <div><span>HP</span><strong>${esc(a.hp.current)} / ${esc(a.hp.max)}</strong></div>
      </div>
    </section>
    <section class="card">
      <h3>Combat stats</h3>
      <div class="stat-grid">${statCells(a.stats)}</div>
    </section>
    <section class="card">
      <h3>Known zones</h3>
      <div class="region-list">
        ${known.map((r) => `<div class="region-row"><span><strong>${esc(r.zoneId.toUpperCase())}</strong><br><small>${esc(r.name)}</small></span><span class="tag">Known</span></div>`).join("")}
      </div>
    </section>
    <section class="card">
      <h3>Current expedition</h3>
      <p><strong>${esc(a.currentExpedition.label)}</strong></p>
      <p>${esc(a.currentExpedition.objective)}</p>
      <p>${esc(a.currentExpedition.progressLabel)}</p>
    </section>
  `;
}

function renderEncounter() {
  const e = fixture.encounter;
  const a = fixture.adventurer;
  return `
    <section class="card">
      <div class="combatants">
        <div class="combatant">
          <small>CLONE</small>
          <h3>${esc(a.name)}</h3>
          <p>Lv.${esc(a.level)} · HP ${esc(a.hp.current)}/${esc(a.hp.max)}</p>
        </div>
        <div class="vs">VS</div>
        <div class="combatant">
          <small>WILD MONSTER</small>
          <h3>${esc(e.monster.name)}</h3>
          <p>Lv.${esc(e.monster.level)} · ${e.monster.types.map(esc).join(" / ")}</p>
          <p>HP ${esc(e.monster.hp.current)}/${esc(e.monster.hp.max)}</p>
        </div>
      </div>
    </section>
    <section class="card">
      <h3>Damage / status feedback</h3>
      <div class="feedback-list">
        ${e.feedback.map((f) => `<div class="feedback"><span>${esc(f.label)}<br><small>${esc(f.detail)}</small></span><strong>${esc(f.value)}</strong></div>`).join("")}
      </div>
    </section>
    <section class="card">
      <p>This is a frozen outcome visualization. HUD buttons do not calculate or dispatch combat.</p>
    </section>
  `;
}

function renderLoot() {
  const l = fixture.loot;
  return `
    <section class="card">
      <p>Verified outcome fixture: <strong>${esc(l.outcomeId)}</strong></p>
      <div class="loot-list">
        ${l.items.map((item) => `
          <div class="loot-row">
            <span><strong>${esc(item.itemKind)}</strong><br><small>Quantity ${esc(item.quantity)}</small></span>
            <span class="tag ${esc(item.rarity.toLowerCase())}">${esc(item.rarity)}</span>
          </div>`).join("")}
      </div>
    </section>
    <div class="inline-actions">
      <button data-prototype-action="return">Return to world</button>
      <button class="emphasis" data-prototype-action="continue">Continue expedition</button>
    </div>
  `;
}

function compareRows(compare) {
  return ["ATK", "DEF", "SPATK", "SPDEF", "SPD"].map((key) => {
    const delta = compare.after[key] - compare.before[key];
    const cls = delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "";
    const sign = delta > 0 ? "+" : "";
    return `<tr><td>${key}</td><td>${compare.before[key]}</td><td>${compare.after[key]}</td><td class="${cls}">${sign}${delta}</td></tr>`;
  }).join("");
}

function renderEquipment() {
  const eq = fixture.equipment;
  return `
    <section class="card">
      <h3>Equipped</h3>
      <div class="slot-list">
        ${Object.entries(eq.slots).map(([slot, item]) => `
          <div class="slot-row">
            <span><small>${esc(slot.toUpperCase())}</small><br><strong>${esc(item.name)}</strong></span>
            <span class="tag">${esc(item.levelLabel)}</span>
          </div>`).join("")}
      </div>
    </section>
    <section class="card">
      <h3>Compare: ${esc(eq.candidate.name)}</h3>
      <table class="compare-table">
        <thead><tr><th>Stat</th><th>Before</th><th>After</th><th>Delta</th></tr></thead>
        <tbody>${compareRows(eq.compare)}</tbody>
      </table>
    </section>
    <section class="card">
      <h3>Upgrade preview</h3>
      <div class="key-value">
        <div><span>Item</span><strong>${esc(eq.upgradePreview.itemName)}</strong></div>
        <div><span>Upgrade</span><strong>${esc(eq.upgradePreview.fromLabel)} → ${esc(eq.upgradePreview.toLabel)}</strong></div>
        <div><span>Cost preview</span><strong>${esc(eq.upgradePreview.costLabel)}</strong></div>
        <div><span>Projected change</span><strong>${esc(eq.upgradePreview.statPreview)}</strong></div>
      </div>
      <p>Preview only. No inventory, currency, RNG, or upgrade authority is invoked.</p>
    </section>
  `;
}

function renderRegions() {
  return `
    <section class="card">
      <h3>Region viewer</h3>
      <div class="region-list">
        ${fixture.regions.map((r) => {
          const displayName = r.known ? r.name : "Unknown region";
          const state = r.known ? '<span class="tag">Known</span>' : '<span class="tag unknown">Unknown</span>';
          const details = r.known ? esc(r.summary) : "Content hidden — no inferred unlock";
          return `
            <div class="region-row">
              <span>
                <strong>${esc(r.zoneId.toUpperCase())} · ${esc(displayName)}</strong><br>
                <small>Recommended Lv.${esc(r.minLevel)}–${esc(r.maxLevel)} · ${details}</small>
              </span>
              ${state}
            </div>`;
        }).join("")}
      </div>
    </section>
    <section class="card">
      <p>Known/unknown comes only from the fixture snapshot. The prototype does not unlock, discover, or mutate a region.</p>
    </section>
  `;
}

const panels = {
  inspector: { kicker: "ADVENTURER", title: "Inspector", render: renderInspector },
  encounter: { kicker: "ENCOUNTER", title: "Clone vs Monster", render: renderEncounter },
  loot: { kicker: "RESULT", title: "Loot", render: renderLoot },
  equipment: { kicker: "LOADOUT", title: "Equipment", render: renderEquipment },
  regions: { kicker: "WORLD", title: "Regions", render: renderRegions }
};

function openPanel(name) {
  if (!fixture || !panels[name]) return;
  const panel = panels[name];
  sheetKicker.textContent = panel.kicker;
  sheetTitle.textContent = panel.title;
  sheetContent.innerHTML = panel.render();
  sheet.setAttribute("aria-hidden", "false");
}

function closePanel() {
  sheet.setAttribute("aria-hidden", "true");
}

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-open]");
  if (opener) {
    openPanel(opener.dataset.open);
    return;
  }

  const hudAction = event.target.closest("[data-action]");
  if (hudAction) {
    showToast(hudAction.textContent.trim() + " is UI-only in this prototype.");
    return;
  }

  const prototypeAction = event.target.closest("[data-prototype-action]");
  if (prototypeAction) {
    const label = prototypeAction.dataset.prototypeAction === "continue"
      ? "Continue is a no-op prototype intent."
      : "Return closes the result sheet only.";
    showToast(label);
    if (prototypeAction.dataset.prototypeAction === "return") closePanel();
  }
});

document.querySelector("#close-sheet").addEventListener("click", closePanel);

async function init() {
  try {
    const response = await fetch(FIXTURE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Fixture load failed: " + response.status);
    fixture = await response.json();
    renderWorld();
    openPanel("inspector");
  } catch (error) {
    document.querySelector("#expedition-title").textContent = "Fixture unavailable";
    document.querySelector("#expedition-detail").textContent =
      "Serve docs/wip/adventure-ui over HTTP so preview.html can read its local JSON fixture.";
    console.error(error);
  }
}

init();
