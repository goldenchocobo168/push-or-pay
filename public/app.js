// Push or Pay — main app. Reads /c/<id>?t=<token>, loads state, renders the
// doer (owner) or profiteer (partner) view. The streak is the hero.
(function () {
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const parts = location.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  const token = new URLSearchParams(location.search).get("t") || "";
  let COPY = {}, D = null, seed = 0;

  const api = (action, body) => fetch(`/api?action=${action}&id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, {
    method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "error"); return d; });

  const toast = (t) => { toastEl.textContent = t; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), 1800); };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = (arr) => (arr && arr.length ? arr[Math.abs(seed) % arr.length] : "");

  function heatmapHTML(heat) {
    let cols = "";
    for (let i = 0; i < heat.length; i += 7) cols += '<div class="col">' + heat.slice(i, i + 7).map((d) => `<div class="cell ${d.status}" title="${d.date}"></div>`).join("") + "</div>";
    return `<div class="heat">${cols}</div><div class="legend">
      <span><i class="dot" style="background:var(--green)"></i>Done</span>
      <span><i class="dot" style="background:#7a1d1d"></i>Missed</span>
      <span><i class="dot" style="background:#2f3947;box-shadow:inset 0 0 0 1.5px var(--fire)"></i>Today</span></div>`;
  }

  function shareCardHTML(d) {
    const last28 = d.heat.slice(-28);
    let grid = "";
    for (let i = 0; i < last28.length; i += 7) grid += '<div class="line">' + last28.slice(i, i + 7).map((x) => {
      const col = x.status === "done" ? "var(--green)" : x.status === "missed" ? "#7a1d1d" : "#242a33";
      return `<div class="sq" style="background:${col}"></div>`;
    }).join("") + "</div>";
    const head = d.partner_earned > 0
      ? `😭 ${esc(d.partner_name)} earned ${esc(d.week_earned_display)} this week`
      : `🔥 ${d.streak}-day streak · ${esc(d.partner_name)} earned nothing`;
    return `<div class="share-card" id="shareCard">
      <div class="top">🔥 ${d.streak}-DAY STREAK · PUSH-UPS</div>
      <div class="grid">${grid}</div>
      <div class="headline">${head}</div>
    </div><button class="btn secondary" id="shareBtn">Share this card 📣</button>`;
  }

  function cheersRow(d) {
    const list = (d.cheers && d.cheers[d.today]) || [];
    if (!list.length) return "";
    return `<div class="center" style="margin-top:10px">` + list.map((r) => `<span class="pill">${esc(r.emoji)}</span>`).join("") + `</div>`;
  }

  // ---- OWNER (the doer) --------------------------------------------------
  function renderOwnerDashboard(d) {
    const penChip = `<div class="penalty-chip"><span class="big">${esc(d.penalty_display)}</span>${d.penalty_usd_hint ? `<span class="hint">😏 ≈ ${esc(d.penalty_usd_hint)}</span>` : ""}</div>`;
    app.innerHTML = `
      <div class="brand"><span class="logo">💪</span> Push or Pay</div>
      <div class="card hero-streak">
        <div class="flame">🔥</div><div class="days">${d.streak}</div>
        <div class="label">Day streak</div>
        <div class="joke">${esc(pick(COPY.dashboard))}</div>
      </div>
      <div class="card today-card">
        <div class="goal">Today's mission</div>
        <div class="prog">${d.today_reps} / ${d.daily_target} push-ups</div>
        <div class="pen">Miss it and ${esc(d.partner_name)} earns</div>
        ${penChip}
        <div>${d.today_done
          ? `<button class="btn" disabled>Done today ✅</button>`
          : `<button class="btn lg" id="startBtn">Start ${d.daily_target} push-ups</button>`}</div>
      </div>
      ${cheersRow(d)}
      <div class="stats">
        <div class="stat"><div class="n streak">${d.streak}🔥</div><div class="l">Streak</div></div>
        <div class="stat"><div class="n earn">${esc(d.partner_earned_display)}</div><div class="l">${esc(d.partner_name)} earned</div></div>
      </div>
      <div class="card"><h2>Last 90 days</h2>${heatmapHTML(d.heat)}</div>
      ${shareCardHTML(d)}
      <div class="card links"><h2>Invite ${esc(d.partner_name)}</h2>
        <div class="lk"><input readonly id="inviteInput" value="${location.origin + d.invite_link}" /><button class="copy" id="copyInvite">Copy</button></div>
        <p class="hint" style="text-align:left">Give ${esc(d.partner_name)} the power 😈 — they'll see your streak, cheer you on, and can raise the penalty.</p>
      </div>
      <p class="foot">The streak is the hero. The penalty is the joke.</p>`;
    const sb = document.getElementById("startBtn"); if (sb) sb.onclick = () => renderSession(d);
    const ci = document.getElementById("copyInvite"); if (ci) ci.onclick = () => copy(document.getElementById("inviteInput").value, "Invite link copied 📋");
    wireShare(d);
  }

  function renderSession(d) {
    let reps = d.today_reps || 0; const target = d.daily_target; const started = Date.now(); let t0 = Date.now();
    app.innerHTML = `
      <div class="brand"><span class="logo">💪</span> Push or Pay</div>
      <div class="card session">
        <div class="count" id="count">${reps}</div>
        <div class="of">of ${target}</div>
        <div class="bonus" id="bonus"></div>
        <div class="timer" id="timer">0:00</div>
        <button class="tap" id="tap">TAP<small>chin, finger, nose — your call</small></button>
        <button class="btn" id="doneBtn" style="margin-top:22px">Complete</button>
        <button class="btn ghost" id="backBtn">Back</button>
        <p class="hint center">Put the phone on the floor. Tap with your chin each rep. (We won't judge if you use a finger.)</p>
      </div>`;
    const countEl = document.getElementById("count"), bonusEl = document.getElementById("bonus"), timerEl = document.getElementById("timer");
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 500);
    const bump = () => { reps++; countEl.textContent = reps; if (reps > target) bonusEl.textContent = `+${reps - target} bonus 💪`; else if (reps === target) bonusEl.textContent = `Target hit! Keep going? 🔥`; if (navigator.vibrate) navigator.vibrate(8); };
    document.getElementById("tap").onclick = bump;
    document.getElementById("doneBtn").onclick = async () => {
      clearInterval(tick);
      const dur = Math.round((Date.now() - started) / 1000);
      try { const nd = await api("session", { reps, duration_seconds: dur, started_at: started }); renderComplete(nd, reps, dur); }
      catch (e) { toast(e.message); }
    };
    document.getElementById("backBtn").onclick = () => { clearInterval(tick); renderOwnerDashboard(d); };
  }

  function renderComplete(d, reps, dur) {
    const hit = reps >= d.daily_target;
    app.innerHTML = `
      <div class="brand"><span class="logo">💪</span> Push or Pay</div>
      <div class="card hero-streak">
        <div class="flame">${hit ? "🎉" : "😅"}</div>
        <div class="days" style="font-size:40px">${reps}</div>
        <div class="label">push-ups${reps > d.daily_target ? ` · +${reps - d.daily_target} bonus` : ""}</div>
        <div class="joke">${hit ? esc(pick(COPY.success)) : "Not quite target — but effort logged. Your call if it counts."}</div>
      </div>
      <div class="card center">
        <p class="lead">${hit ? `🔥 Streak protected — Day ${d.streak}` : `Streak needs ${d.daily_target} to lock in`}</p>
        <p class="hint">Duration: ${Math.floor(dur / 60)}m ${dur % 60}s</p>
        <button class="btn" id="okBtn">Back to dashboard</button>
      </div>`;
    document.getElementById("okBtn").onclick = () => renderOwnerDashboard(d);
    fireConfetti(hit);
  }

  // ---- PARTNER (the profiteer / lovable villain) -------------------------
  function renderPartner(d) {
    const penChip = `<div class="penalty-chip"><span class="big">${esc(d.penalty_display)}</span>${d.penalty_usd_hint ? `<span class="hint">😏 ≈ ${esc(d.penalty_usd_hint)}</span>` : ""}</div>`;
    app.innerHTML = `
      <div class="brand"><span class="logo">😈</span> Push or Pay</div>
      <p class="tag">${esc(pick(COPY.partner_watching))}</p>
      <div class="card hero-streak">
        <div class="flame">🔥</div><div class="days">${d.streak}</div>
        <div class="label">${esc(d.owner_name)}'s streak</div>
        <div class="joke">${d.today_done ? `✅ ${esc(d.owner_name)} did today's push-ups. You earn nothing. 😑` : `${esc(d.owner_name)} hasn't done today's push-ups yet… 👀`}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n earn">${esc(d.partner_earned_display)}</div><div class="l">You've earned</div></div>
        <div class="stat"><div class="n earn">${esc(d.week_earned_display)}</div><div class="l">This week</div></div>
      </div>
      <div class="card center">
        <h2>Cheer… or heckle 😈</h2>
        <div class="reacts">
          <button data-e="🔥">🔥</button><button data-e="👀">👀</button><button data-e="😤">😤</button>
          <button data-e="🍿">🍿</button><button data-e="🧋">🧋</button><button data-e="💸">💸</button>
        </div>
        ${cheersRow(d)}
      </div>
      <div class="card center">
        <h2>Raise the stakes 😈</h2>
        <div class="pen">Current penalty: ${esc(d.penalty_display)}${d.penalty_usd_hint ? ` (≈ ${esc(d.penalty_usd_hint)})` : ""}</div>
        <div class="choice" style="margin-top:6px">
          <button class="raise" data-mult="2"><span class="t">Double it</span><span class="d">${esc(money2(d.penalty_amount * 2, d.currency))}</span></button>
          <button class="raise" data-mult="5"><span class="t">5×</span><span class="d">${esc(money2(d.penalty_amount * 5, d.currency))}</span></button>
        </div>
        <div class="lk" style="margin-top:12px"><input id="customPen" type="number" placeholder="Custom amount" /><button class="copy" id="setPen">Set</button></div>
        <p class="hint">${esc(d.owner_name)} will get the bad news. 😈</p>
      </div>
      <div class="card"><h2>Last 90 days</h2>${heatmapHTML(d.heat)}</div>
      ${shareCardHTML(d)}
      <p class="foot">You're the lovable final boss. Play nice. Ish.</p>`;
    document.querySelectorAll(".reacts button").forEach((b) => b.onclick = async () => { try { render(await api("cheer", { emoji: b.dataset.e })); toast(`${b.dataset.e} sent`); } catch (e) { toast(e.message); } });
    document.querySelectorAll(".raise").forEach((b) => b.onclick = () => raise(d.penalty_amount * Number(b.dataset.mult), d));
    document.getElementById("setPen").onclick = () => { const v = Number(document.getElementById("customPen").value); if (v > 0) raise(v, d); };
    wireShare(d);
  }

  async function raise(amount, d) {
    amount = Math.round(amount);
    if (!confirm(`Raise the penalty to ${money2(amount, d.currency)}? ${esc(d.owner_name)} will be notified. 😈`)) return;
    try { render(await api("penalty", { amount })); toast(`${pick(COPY.penalty_raised) || "Done"} Penalty → ${money2(amount, d.currency)}`); }
    catch (e) { toast(e.message); }
  }

  // Client-side money format (mirror of server money()).
  function money2(amount, cur) { cur = cur || "$"; const n = cur === "Rp" ? Number(amount).toLocaleString("en-US") : amount; return `${cur}${cur === "Rp" ? " " : ""}${n}`; }

  // ---- prank alert (doer opens a challenge set up FOR them) --------------
  function renderPrankAlert(d, then) {
    app.innerHTML = `
      <div class="brand"><span class="logo">😈</span> Push or Pay</div>
      <div class="card prank-alert">
        <div class="emoji-xl">😈</div>
        <div class="who">${esc(d.partner_name)} challenged you!</div>
        <p class="lead">Do <b>${d.daily_target} push-ups</b> every day… or they profit.</p>
        <div class="big-num" id="bignum">${esc(d.penalty_display)}</div>
        <div class="reveal" id="reveal">per missed day 😳</div>
        <button class="btn fire" id="acceptBtn" style="margin-top:18px">😤 Accept the challenge</button>
        <button class="btn ghost" id="peekBtn">Just let me see it</button>
      </div>`;
    // The gag: a beat later, deflate the scary number (esp. IDR).
    if (d.penalty_usd_hint) setTimeout(() => { const r = document.getElementById("reveal"); if (r) r.innerHTML = `…wait. That's just <b>≈ ${esc(d.penalty_usd_hint)}</b> 😅 (${esc(d.currency)} ${esc(String(d.penalty_amount))})`; }, 1600);
    document.getElementById("acceptBtn").onclick = then;
    document.getElementById("peekBtn").onclick = then;
  }

  // ---- shared ------------------------------------------------------------
  function wireShare(d) {
    const sb = document.getElementById("shareBtn"); if (!sb) return;
    sb.onclick = async () => {
      const text = d.partner_earned > 0
        ? `😭 ${d.partner_name} earned ${d.week_earned_display} this week because I skipped push-ups. Streak: ${d.streak}. Push or Pay.`
        : `🔥 ${d.streak}-day push-up streak — ${d.partner_name} earned nothing off me. Push or Pay.`;
      api("share").catch(() => {});
      if (navigator.share) { try { await navigator.share({ title: "Push or Pay", text, url: location.origin }); } catch (_) {} }
      else { try { await navigator.clipboard.writeText(text + " " + location.origin); toast("Copied — paste it anywhere 📣"); } catch (_) { toast(text); } }
    };
  }
  const copy = async (v, m) => { try { await navigator.clipboard.writeText(v); } catch (_) {} toast(m); };

  function fireConfetti(hit) {
    if (!hit) return;
    const n = 40; const wrap = document.createElement("div"); wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:99";
    for (let i = 0; i < n; i++) { const s = document.createElement("div"); const x = (i * 37) % 100; const dur = 1.4 + (i % 5) * 0.25;
      s.style.cssText = `position:absolute;top:-10px;left:${x}%;width:8px;height:8px;border-radius:2px;background:${["#ff7b29","#3fb950","#7c5cff","#e3a008"][i % 4]};animation:fall ${dur}s linear forwards`; wrap.appendChild(s); }
    document.body.appendChild(wrap); setTimeout(() => wrap.remove(), 2600);
  }

  function render(d) { D = d; if (d.role === "owner") renderOwnerDashboard(d); else renderPartner(d); }

  if (!id || !token) { app.innerHTML = errHtml("This link is missing its access token. Ask for the full link."); return; }
  Promise.all([
    fetch("/copy.json").then(r => r.json()).catch(() => ({})),
    api("get"),
  ]).then(([copyJson, d]) => {
    COPY = copyJson; seed = (d.missed_count || 0) + (d.streak || 0);
    if (d.role === "owner" && d.prank_alert) renderPrankAlert(d, () => render(d));
    else render(d);
  }).catch((e) => { app.innerHTML = errHtml(e.message); });

  function errHtml(m) { return `<div class="brand"><span class="logo">💪</span> Push or Pay</div><p class="msg err">${esc(m)}</p><p class="msg"><a href="/">Create a challenge →</a></p>`; }
})();
