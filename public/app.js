// Push or Pay — main app (v3). A playful game for two: the streak is the hero,
// the Lazy Tax is the punchline, your partner is the lovable final boss.
(function () {
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const parts = location.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  const token = new URLSearchParams(location.search).get("t") || "";
  let COPY = {}, seed = 0;

  const api = (action, body) => fetch(`/api?action=${action}&id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, {
    method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "error"); return d; });

  const toast = (t) => { toastEl.textContent = t; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), 2200); };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = (arr) => (arr && arr.length ? arr[Math.abs(seed) % arr.length] : "");
  const money2 = (a, cur) => { cur = cur || "$"; const n = cur === "Rp" ? Number(a).toLocaleString("en-US") : a; return `${cur}${cur === "Rp" ? " " : ""}${n}`; };
  const fmtDur = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const niceDate = (iso) => { const [y, m, dd] = iso.split("-"); return new Date(Date.UTC(+y, +m - 1, +dd)).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

  function heatmapHTML(heat) {
    let cols = "";
    for (let i = 0; i < heat.length; i += 7) cols += '<div class="col">' + heat.slice(i, i + 7).map((d) => `<div class="cell ${d.status}" data-date="${d.date}"></div>`).join("") + "</div>";
    return `<div class="heat">${cols}</div>
      <div class="legend">
        <span><i class="dot" style="background:var(--green)"></i>Done</span>
        <span><i class="dot" style="background:#7a2626"></i>Skip</span>
        <span><i class="dot" style="background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1.5px var(--fire)"></i>Today</span>
      </div>
      <div class="day-detail hint" id="dayDetail">Tap a square to peek at that day.</div>`;
  }
  function wireHeat(d) {
    const det = document.getElementById("dayDetail"); if (!det) return;
    document.querySelectorAll(".cell[data-date]").forEach((c) => c.onclick = () => {
      const date = c.dataset.date, s = (d.sessions || {})[date];
      if (s && s.reps >= (s.target || d.daily_target)) det.innerHTML = `<b>${niceDate(date)}</b> · ✅ ${s.reps} push-ups · ${fmtDur(s.duration_seconds || 0)}`;
      else if (s) det.innerHTML = `<b>${niceDate(date)}</b> · ${s.reps} reps — didn't reach ${s.target || d.daily_target}`;
      else if (c.classList.contains("missed")) det.innerHTML = `<b>${niceDate(date)}</b> · 😅 skip day`;
      else if (c.classList.contains("today")) det.innerHTML = `<b>Today</b> · still time to keep the green alive`;
      else det.textContent = "Nothing here yet.";
    });
  }

  function shareCardHTML(d) {
    const last28 = d.heat.slice(-28); let grid = "";
    for (let i = 0; i < last28.length; i += 7) grid += '<div class="line">' + last28.slice(i, i + 7).map((x) => {
      const col = x.status === "done" ? "var(--green)" : x.status === "missed" ? "#7a2626" : "#242a33"; return `<div class="sq" style="background:${col}"></div>`;
    }).join("") + "</div>";
    const head = d.partner_earned > 0 ? `😭 ${esc(d.partner_name)} earned ${esc(d.week_earned_display)} this week` : `🔥 ${d.streak}-day streak · untouched`;
    return `<div class="share-card"><div class="top">🔥 ${d.streak}-DAY STREAK · PUSH-UPS</div><div class="grid">${grid}</div><div class="headline">${head}</div></div>
      <button class="btn ghost block" id="shareBtn">Share this card 📣</button>`;
  }
  function cheersRow(d) {
    const list = (d.cheers && d.cheers[d.today]) || []; if (!list.length) return "";
    return `<div class="center" style="margin-top:10px">` + list.map((r) => `<span class="pill">${esc(r.emoji)}</span>`).join("") + `</div>`;
  }
  const lazyLabel = (d) => `${esc(d.penalty_display)}${d.penalty_usd_hint ? `<span class="h"> 😏 ≈ ${esc(d.penalty_usd_hint)}</span>` : ""}`;

  // ============ OWNER (the one keeping the streak) ============
  function renderOwnerDashboard(d) {
    const banner = d.lazy_tax_update
      ? `<div class="card banner"><div>🚨 <b>${esc(d.partner_name)}</b> raised your Lazy Tax<br/><span class="big">${esc(d.lazy_tax_update.from)} → ${esc(d.lazy_tax_update.to)}</span><div class="hint">${esc(pick(COPY.lazy_tax_raised))}</div></div><button class="btn ghost" id="ackBtn">Got it 😤</button></div>` : "";
    const streakJoke = (d.streak === 0 && d.missed_count > 0) ? esc(pick(COPY.skip)) : esc(pick(COPY.dashboard));
    // hero varies by mode: normal (x/30) · challenge complete · Secret/Hardcore (uncapped + tier)
    let heroTop, heroSub;
    if (d.secret_unlocked) {
      const t = d.hardcore_tier || {};
      heroTop = `<div class="flame">🔥</div><div class="days">${d.display_streak}</div><div class="label">${esc(t.name || "Hardcore")} mode${t.next ? ` · ${t.next - d.display_streak} to ${t.next}` : ""}</div>`;
      heroSub = `<div class="joke">🔓 Secret Mode. No 30-day limit. ${streakJoke}</div>`;
    } else if (d.challenge_complete) {
      heroTop = `<div class="flame">🎉</div><div class="days">30</div><div class="label">Challenge complete</div>`;
      heroSub = `<div class="joke">You did the 30 days. Most people stop here… 👀</div>`;
    } else {
      heroTop = `<div class="flame">🔥</div><div class="days">${d.display_streak}<span class="cap">/30</span></div><div class="label">Day streak</div>`;
      heroSub = `<div class="joke">${streakJoke}</div>`;
    }
    app.innerHTML = `
      ${banner}
      <div class="app-grid">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="hero-streak${d.secret_unlocked ? " secret" : ""}">
            ${heroTop}
            ${heroSub}
          </div>
          <div class="card today-card">
            <div class="goal">Today's challenge</div>
            <div class="prog">${d.today_reps} / ${d.daily_target} push-ups</div>
            ${d.today_done
              ? `<button class="btn block" disabled style="margin-top:12px">Done today ✅</button>`
              : `<button class="btn block lg" id="startBtn" style="margin-top:12px">Start</button>`}
            ${cheersRow(d)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card"><h2>Your journey</h2>${heatmapHTML(d.heat)}</div>
          <div class="card center lazy-card">
            <div class="lz-label">Lazy Tax 💸</div>
            <div class="lz-amt">${lazyLabel(d)}</div>
            <div class="hint">${esc(d.partner_name)} collects it every day you skip.${d.accepted ? "" : ` (once they join)`}</div>
          </div>
          ${shareCardHTML(d)}
          <div class="card">
            <h2>${d.accepted ? `👀 ${esc(d.partner_name)} is watching` : `Invite ${esc(d.partner_name)}`}</h2>
            ${d.accepted
              ? `<p class="hint">They're in the game — cheering, teasing, and one tap away from raising your Lazy Tax. 😈</p>`
              : `<div class="lk"><input readonly id="inviteInput" value="${location.origin + d.invite_link}" /><button class="copy" id="copyInvite">Copy</button></div>
                 <p class="hint">Send it over — the fun starts the moment they open it. 😈</p>`}
          </div>
        </div>
      </div>`;
    const sb = document.getElementById("startBtn"); if (sb) sb.onclick = () => renderSession(d);
    const ci = document.getElementById("copyInvite"); if (ci) ci.onclick = () => copy(document.getElementById("inviteInput").value, "Invite copied 📋 — send it over 😈");
    const ack = document.getElementById("ackBtn"); if (ack) ack.onclick = async () => { try { render(await api("lazy_tax_ack", {})); } catch (e) { toast(e.message); } };
    wireHeat(d); wireShare(d);
  }

  function renderSession(d) {
    let reps = d.today_reps || 0; const target = d.daily_target; const started = Date.now(); const t0 = Date.now();
    app.innerHTML = `
      <div class="session">
        <div class="of" style="margin-bottom:6px">${target} push-ups</div>
        <div class="count" id="count">${reps}</div>
        <div class="bonus" id="bonus"></div>
        <div class="timer" id="timer">0:00</div>
        <button class="tap" id="tap">TAP<small>with your chin 😌</small></button>
        <button class="btn block" id="doneBtn" style="margin-top:22px">Complete</button>
        <button class="btn ghost block" id="backBtn">Back</button>
        <p class="hint center">Phone on the floor, tap with your chin each rep. (A finger works too — we won't tell.)</p>
      </div>`;
    const countEl = document.getElementById("count"), bonusEl = document.getElementById("bonus"), timerEl = document.getElementById("timer");
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 500);
    document.getElementById("tap").onclick = () => { reps++; countEl.textContent = reps; if (reps > target) bonusEl.textContent = `+${reps - target} bonus 💪`; else if (reps === target) bonusEl.textContent = `Target hit! Keep going? 🔥`; if (navigator.vibrate) navigator.vibrate(8); };
    document.getElementById("doneBtn").onclick = async () => { clearInterval(tick); const dur = Math.round((Date.now() - started) / 1000);
      try { const nd = await api("session", { reps, duration_seconds: dur, started_at: started }); renderComplete(nd, reps, dur); } catch (e) { toast(e.message); } };
    document.getElementById("backBtn").onclick = () => { clearInterval(tick); renderOwnerDashboard(d); };
  }

  function renderComplete(d, reps, dur) {
    const hit = reps >= d.daily_target;
    app.innerHTML = `
      <div class="panel">
        <div class="hero-streak">
          <div class="flame">${hit ? "🔥" : "😅"}</div>
          <div class="days" style="font-size:44px">${hit ? "Streak" : reps}</div>
          <div class="label">${hit ? `protected · day ${d.streak}` : "push-ups logged"}</div>
          <div class="joke">${hit ? esc(pick(COPY.success)) : "Not quite the target — but hey, you showed up. 💛"}</div>
        </div>
        <div class="card center">
          <div class="prog">${reps} push-ups${reps > d.daily_target ? ` · +${reps - d.daily_target} bonus 💪` : ""}</div>
          <div class="hint">Duration ${fmtDur(dur)} · ${esc(d.partner_name)} earned ${esc(money2(0, d.currency))} today 😂</div>
          <button class="btn block lg" id="okBtn" style="margin-top:16px">Back to my streak</button>
        </div>
      </div>`;
    document.getElementById("okBtn").onclick = () => renderOwnerDashboard(d);
    if (hit) confetti();
  }

  // ============ PARTNER — invitation → accept → watcher ============
  function renderInvitation(d) {
    app.innerHTML = `
      <div class="panel">
        <div class="card invite-card center">
          <div class="emoji-xl">😈</div>
          <h1 class="title" style="margin-bottom:8px">You've been invited</h1>
          <p class="lead"><b>${esc(d.owner_name)}</b> is trying to build a habit.</p>
          <div class="invite-row"><span class="k">Daily challenge</span><span class="v">💪 ${d.daily_target} push-ups</span></div>
          <div class="invite-row"><span class="k">If ${esc(d.owner_name)} skips</span><span class="v">you get ${lazyLabel(d)}</span></div>
          <div class="invite-row"><span class="k">Your mission</span><span class="v">keep watching 👀</span></div>
          <button class="btn fire block lg" id="acceptBtn" style="margin-top:18px">Accept challenge 😈</button>
        </div>
      </div>`;
    document.getElementById("acceptBtn").onclick = async () => { try { const nd = await api("accept", {}); renderAccepted(nd); } catch (e) { toast(e.message); } };
  }
  function renderAccepted(d) {
    app.innerHTML = `
      <div class="panel">
        <div class="card center">
          <div class="emoji-xl">🎉</div>
          <h1 class="title">You're in 😈</h1>
          <p class="lead">You can now…</p>
          <div class="power-list">
            <div>🔥 See ${esc(d.owner_name)}'s streak</div>
            <div>😂 Watch every push-up (or skip)</div>
            <div>💸 Raise their Lazy Tax whenever you like</div>
          </div>
          <p class="hint" style="margin-top:16px">Good luck, ${esc(d.owner_name)}. You'll need it. 💛</p>
          <button class="btn block lg" id="goBtn" style="margin-top:14px">Enter the game</button>
        </div>
      </div>`;
    document.getElementById("goBtn").onclick = () => renderWatcher(d);
    confetti();
  }
  function renderWatcher(d) {
    app.innerHTML = `
      <p class="hint center" style="margin-bottom:14px">${esc(pick(COPY.watcher))}</p>
      <div class="app-grid">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="hero-streak">
            <div class="flame">🔥</div><div class="days">${d.streak}</div><div class="label">${esc(d.owner_name)}'s streak</div>
            <div class="joke">${d.today_done ? `✅ ${esc(d.owner_name)} did today's push-ups. You earn nothing. 😑` : `${esc(d.owner_name)} hasn't done today's push-ups yet… 👀`}</div>
          </div>
          <div class="stats">
            <div class="stat"><div class="n earn">${esc(d.partner_earned_display)}</div><div class="l">You've collected</div></div>
            <div class="stat"><div class="n earn">${esc(d.week_earned_display)}</div><div class="l">This week</div></div>
          </div>
          <div class="card center">
            <h2>Cheer… or tease 😈</h2>
            <div class="reacts">
              <button data-e="🔥">🔥</button><button data-e="👀">👀</button><button data-e="😂">😂</button>
              <button data-e="🍿">🍿</button><button data-e="🧋">🧋</button><button data-e="💛">💛</button>
            </div>
            ${cheersRow(d)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card center lazy-card">
            <div class="lz-label">Raise the Lazy Tax 😈</div>
            <div class="lz-amt">${lazyLabel(d)}</div>
            <div class="choice" style="margin-top:12px">
              <button class="raise" data-mult="2"><span class="t">Double it</span><span class="d">${esc(money2(d.penalty_amount * 2, d.currency))}</span></button>
              <button class="raise" data-mult="5"><span class="t">5×</span><span class="d">${esc(money2(d.penalty_amount * 5, d.currency))}</span></button>
            </div>
            <div class="lk" style="margin-top:12px"><input id="customPen" type="number" placeholder="Custom amount" /><button class="copy" id="setPen">Set</button></div>
            <p class="hint">${esc(d.owner_name)} gets the (loving) bad news instantly. 💛😈</p>
          </div>
          <div class="card"><h2>${esc(d.owner_name)}'s journey</h2>${heatmapHTML(d.heat)}</div>
          ${shareCardHTML(d)}
        </div>
      </div>`;
    document.querySelectorAll(".reacts button").forEach((b) => b.onclick = async () => { try { render(await api("cheer", { emoji: b.dataset.e })); toast(`${b.dataset.e} sent`); } catch (e) { toast(e.message); } });
    document.querySelectorAll(".raise").forEach((b) => b.onclick = () => raise(d.penalty_amount * Number(b.dataset.mult), d));
    document.getElementById("setPen").onclick = () => { const v = Number(document.getElementById("customPen").value); if (v > 0) raise(v, d); };
    wireHeat(d); wireShare(d);
  }
  async function raise(amount, d) {
    amount = Math.round(amount);
    if (!confirm(`Raise ${d.owner_name}'s Lazy Tax to ${money2(amount, d.currency)}? They'll be notified 😈`)) return;
    try { render(await api("penalty", { amount })); toast(`Done. Lazy Tax → ${money2(amount, d.currency)} 😈`); } catch (e) { toast(e.message); }
  }

  // ============ shared ============
  function wireShare(d) {
    const sb = document.getElementById("shareBtn"); if (!sb) return;
    sb.onclick = async () => {
      const text = d.partner_earned > 0
        ? `😭 ${d.partner_name} earned ${d.week_earned_display} this week off my skipped push-ups. ${pick(COPY.share_owed)} Push or Pay.`
        : `🔥 ${d.streak}-day push-up streak — ${d.partner_name} earned nothing off me. Push or Pay.`;
      api("share").catch(() => {});
      if (navigator.share) { try { await navigator.share({ title: "Push or Pay", text, url: location.origin }); } catch (_) {} }
      else { try { await navigator.clipboard.writeText(text + " " + location.origin); toast("Copied — paste it anywhere 📣"); } catch (_) { toast(text); } }
    };
  }
  const copy = async (v, m) => { try { await navigator.clipboard.writeText(v); } catch (_) {} toast(m); };
  function confetti() {
    const wrap = document.createElement("div"); wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:99";
    for (let i = 0; i < 44; i++) { const s = document.createElement("div"); const x = (i * 37) % 100; const dur = 1.4 + (i % 5) * 0.25;
      s.style.cssText = `position:absolute;top:-10px;left:${x}%;width:8px;height:8px;border-radius:2px;background:${["#ff8a3d","#4ade80","#8b7cff","#ffcf5c"][i % 4]};animation:fall ${dur}s linear forwards`; wrap.appendChild(s); }
    document.body.appendChild(wrap); setTimeout(() => wrap.remove(), 2600);
  }

  // ============ Secret Mode — the Day-19 one-time reveal ============
  function renderSecretReveal(d) {
    api("secret_seen").catch(() => {}); // burn it: appears once, never again
    app.innerHTML = `
      <div class="secret-veil">
        <div class="secret-inner">
          <div class="lock">🔒</div>
          <p class="s-line">You found something most people never see.</p>
          <p class="s-big">You've reached <b>Day ${d.display_streak}</b>.</p>
          <p class="s-line">There is a hidden mode. Only the disciplined unlock it.</p>
          <p class="s-warn">This message appears once. Choose now.</p>
          <button class="btn fire lg" id="enterSecret">Enter Secret Mode</button>
          <button class="btn ghost" id="notYet">Not yet…</button>
        </div>
      </div>`;
    document.getElementById("enterSecret").onclick = async () => { try { const nd = await api("unlock_secret", {}); toast("🔥 Secret Mode unlocked. No limits now."); renderOwnerDashboard(nd); } catch (e) { toast(e.message); } };
    document.getElementById("notYet").onclick = () => renderOwnerDashboard({ ...d, secret_reveal: false });
  }

  function render(d) {
    if (d.role === "owner") { if (d.secret_reveal) return renderSecretReveal(d); return renderOwnerDashboard(d); }
    if (d.accepted) return renderWatcher(d);
    return renderInvitation(d);
  }

  if (!id || !token) { app.innerHTML = errHtml("This link is missing its access token. Ask for the full link."); return; }
  Promise.all([fetch("/copy.json").then(r => r.json()).catch(() => ({})), api("get")]).then(([c, d]) => {
    COPY = c; seed = (d.missed_count || 0) + (d.streak || 0); render(d);
  }).catch((e) => { app.innerHTML = errHtml(e.message); });
  function errHtml(m) { return `<p class="msg err">${esc(m)}</p><p class="msg"><a href="/">Start a challenge →</a></p>`; }
})();
