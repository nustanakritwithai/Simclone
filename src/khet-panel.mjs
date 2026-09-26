import { createCharacter, loadCharacter, rest, saveCharacter, statsOf } from "./khet/character.mjs?v=0.5.0";
import { encounterShadow, playerStrike, startFight } from "./khet/combat.mjs?v=0.5.0";

const EDGE_ZONE = "z1";
const SLIME_ID = "MON_002";

function edgeShadow(adventurer) {
  return encounterShadow({ zone: EDGE_ZONE, adventurer, monsterId: SLIME_ID });
}

function strikeOnce(adventurer) {
  const shadow = edgeShadow(adventurer);
  if (!shadow?.allowed || shadow.zone !== EDGE_ZONE || shadow.monsterId !== SLIME_ID) {
    throw new Error("shadow_refused");
  }
  const fight = startFight(adventurer, shadow.monsterId, shadow.zone);
  return playerStrike(fight, adventurer);
}

function restAtEdge(adventurer) {
  return rest(adventurer);
}

function line(text) {
  const node = document.createElement("p");
  node.textContent = text;
  return node;
}

function button(action, label) {
  const node = document.createElement("button");
  node.type = "button";
  node.dataset.khetAction = action;
  node.textContent = label;
  node.style.cssText = "min-height:44px;padding:10px 14px;border:1px solid #e8cfa0;border-radius:8px;background:#203b33;color:#f0eee3";
  return node;
}

function paint(root, hero, lines) {
  root.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "เขตศิลา · ขอบค่าย";
  title.style.margin = "0";
  root.append(title, line("โซน z1 เท่านั้น สไลม์ไฟผ่านเงาการเจอศัตรู ไม่แตะโลกโคลน"));
  if (!hero) {
    const input = document.createElement("input");
    input.maxLength = 16;
    input.placeholder = "ชื่อนักเดินป่า";
    input.setAttribute("aria-label", "ชื่อนักเดินป่า");
    input.style.cssText = "min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid #e8cfa0;background:#0b1d18;color:#f0eee3";
    root.append(input, button("create", "สร้างนักเดินป่า"));
  } else {
    const stats = statsOf(hero);
    root.append(line(`${hero.name}  เลือด ${hero.hp}/${stats.hp}`));
    root.append(button("hunt", "สู้หนึ่งยก"), button("rest", "พักที่ขอบค่าย"));
  }
  for (const text of lines) root.append(line(text));
  root.append(button("close", "ปิด"));
}

function mount(doc) {
  const openers = [...doc.querySelectorAll("[data-khet-open]")];
  if (!openers.length || doc.getElementById("khet-panel")) return;
  const root = doc.createElement("section");
  root.id = "khet-panel";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "เขตศิลา");
  root.style.cssText = "position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;gap:12px;padding:20px;padding-bottom:calc(20px + env(safe-area-inset-bottom));background:#142b26;color:#f0eee3;overflow:auto;font:16px/1.5 system-ui,sans-serif";
  doc.body.append(root);
  let hero = null;
  const show = (lines = []) => {
    root.hidden = false;
    paint(root, hero, lines);
  };
  const keep = (next) => {
    hero = next;
    try {
      saveCharacter(hero);
      return [];
    } catch {
      return ["บันทึกในเบราว์เซอร์นี้ไม่ได้"];
    }
  };
  for (const opener of openers) opener.addEventListener("click", () => {
    hero = loadCharacter();
    show();
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-khet-action]")?.dataset.khetAction;
    if (!action) return;
    if (action === "close") {
      root.hidden = true;
      return;
    }
    if (action === "create") {
      const name = root.querySelector("input")?.value ?? "";
      show(keep(createCharacter(name, "ranger")));
      return;
    }
    if (!hero) return;
    if (action === "rest") {
      show(["พักที่ขอบค่าย เลือดเต็ม", ...keep(restAtEdge(hero))]);
      return;
    }
    if (action === "hunt") {
      try {
        const bout = strikeOnce(hero);
        const note = keep(bout.character);
        show([...(bout.fight.log ?? []), ...note]);
      } catch (error) {
        const text = error?.message === "exhausted" ? "หมดแรง ต้องพักก่อน" : "เข้าสนามนี้ไม่ได้";
        show([text]);
      }
    }
  });
}

function bindKhetPanel(doc = globalThis.document) {
  if (!doc?.body || !doc.querySelector) return;
  mount(doc);
}

if (typeof document !== "undefined") bindKhetPanel(document);

export { EDGE_ZONE, SLIME_ID, bindKhetPanel, edgeShadow, restAtEdge, strikeOnce };
