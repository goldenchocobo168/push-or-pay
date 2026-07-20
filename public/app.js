// Reads /c/<id>?t=<token>, loads state, renders the right role view.
(function () {
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  // id from the path (/c/<id>), token from ?t=
  const parts = location.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  const token = new URLSearchParams(location.search).get("t") || "";

  const api = (action, body) =>
    fetch(`/api?action=${action}&id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      return d;
    });

  function toast(t) {
    toastEl.textContent = t;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (v, s, c) => `${c.currency}${v}`;

  function heatmapHTML(heat) {
    // Group into columns of 7 (weeks), oldest first.
    let cols = "";
    for (let i = 0; i < heat.length; i += 7) {
      const week = heat.slice(i, i + 7);
      cols += '<div class="col">' + week.map((d) => `<div class="cell ${d.status}" title="${d.date} · ${d.status}"></div>`).join("") + "</div>";
    }
    return `<div class="heat">${cols}</div>
      <div class="legend">
        <span><i class="dot" style="background:var(--green)"></i>Done</span>
        <span><i class="dot" style="background:#7a1d1d"></i>Missed</span>
        <span><i class="dot" style="background:var(--amber)"></i>Forgiven</span>
        <span><i class="dot" style="background:#2f3947"></i>Today / settled</span>
      </div>`;
  }

  function shareCardHTML(d) {
    const last28 = d.heat.slice(-28);
    let grid = "";
    for (let i = 0; i < last28.length; i += 7) {
      const week = last28.slice(i, i + 7);
      grid += '<div class="line">' + week.map((x) => {
        const col = x.status === "done" ? "var(--green)"
          : x.status === "missed" ? "#7a1d1d"
          : x.status === "forgiven" ? "var(--amber)" : "#242a33";
        return `<div class="sq" style="background:${col}"></div>`;
      }).join("") + "</div>";
    }
    const headline = d.debt > 0
      ? `😅 ${esc(d.owner_name)} owes ${esc(d.partner_name)} ${money(d.debt, 0, d)}`
      : `🔥 ${d.streak}-day streak, ${money(0, 0, d)} owed`;
    return `<div class="card share" id="shareCard">
        <div class="fire">🔥 ${d.streak}-DAY STREAK · ${esc(d.habit).toUpperCase()}</div>
        <div class="grid">${grid}</div>
        <div class="headline">${headline}</div>
      </div>
      <button class="btn secondary" id="shareBtn">Share this card 📣</button>`;
  }

  function reactionsPills(d) {
    const today = d.today;
    const list = (d.reactions && d.reactions[today]) || [];
    if (!list.length) return "";
    return `<div style="text-align:center;margin-top:10px">` +
      list.map((r) => `<span class="pill">${esc(r.emoji)}</span>`).join("") + `</div>`;
  }

  function render(d) {
    const isOwner = d.role === "owner";
    const stats = `
      <div class="stats">
        <div class="stat"><div class="n streak">${d.streak}</div><div class="l">Day streak</div></div>
        <div class="stat"><div class="n debt">${money(d.debt, 0, d)}</div><div class="l">${isOwner ? "You owe" : d.partner_name + " earned"}</div></div>
      </div>`;

    let action = "";
    if (isOwner) {
      action = `
        <div class="card today ${d.today_done ? "done" : ""}">
          <div class="habit">${esc(d.habit)}</div>
          <div class="pen">Miss it and ${esc(d.partner_name)} earns ${money(d.penalty, 0, d)}</div>
          ${d.today_done
            ? `<button class="btn" disabled>Done for today ✅</button>`
            : `<button class="btn" id="doBtn">I did it 💪</button>`}
          <p class="msg">${d.cheer}</p>
        </div>`;
    } else {
      // Partner view
      const missedToday = !d.today_done;
      action = `
        <div class="card today">
          <div class="habit">${esc(d.owner_name)}'s habit: ${esc(d.habit)}</div>
          <div class="pen">${d.today_done ? "✅ Done today — nothing for you." : `Not done yet today. If skipped, you earn ${money(d.penalty, 0, d)}.`}</div>
          <div class="reacts">
            <button data-emoji="🔥">🔥</button>
            <button data-emoji="😤">😤</button>
            <button data-emoji="❤️">❤️</button>
            <button data-emoji="🍿">🍿</button>
            <button data-emoji="💸">💸</button>
          </div>
          ${missedToday ? `<button class="btn ghost" id="forgiveBtn">Forgive today ❤️</button>` : ""}
          <div class="roast">${d.roast}</div>
        </div>`;
    }

    let links = "";
    if (isOwner) {
      const full = (p) => location.origin + p;
      links = `
        <div class="card links">
          <h2>Invite ${esc(d.partner_name)}</h2>
          <div class="lk">
            <input readonly value="${full(d.invite_link)}" id="inviteInput" />
            <button class="copy" id="copyInvite">Copy</button>
          </div>
          <p class="msg" style="text-align:left">Send this link to ${esc(d.partner_name)}. They'll see your streak and cash in on your misses. Bookmark <b>this</b> page — it's your private control panel.</p>
        </div>`;
    }

    let settle = "";
    if (isOwner && d.debt > 0) {
      settle = `<button class="btn ghost" id="settleBtn" style="margin-top:0">Mark ${money(d.debt, 0, d)} as paid ✓</button>`;
    }

    app.innerHTML = `
      <div class="brand"><span class="logo">🏋️</span> Penalty Partner</div>
      <p class="tag">${isOwner ? "Your challenge" : `You're ${esc(d.partner_name)} — ${esc(d.owner_name)}'s accountability partner`}</p>
      ${stats}
      ${action}
      ${reactionsPills(d)}
      <div class="card">
        <h2>Last 90 days</h2>
        ${heatmapHTML(d.heat)}
      </div>
      ${shareCardHTML(d)}
      ${settle}
      ${links}
      <p class="foot">Your habits. Their rewards.</p>`;

    wire(d);
  }

  function wire(d) {
    const doBtn = document.getElementById("doBtn");
    if (doBtn) doBtn.onclick = async () => {
      doBtn.disabled = true;
      try { render(await api("checkin", {})); toast("Nice. Streak protected 🔥"); }
      catch (e) { toast(e.message); doBtn.disabled = false; }
    };

    const forgiveBtn = document.getElementById("forgiveBtn");
    if (forgiveBtn) forgiveBtn.onclick = async () => {
      try { render(await api("forgive", { date: d.today })); toast("Forgiven ❤️"); }
      catch (e) { toast(e.message); }
    };

    const settleBtn = document.getElementById("settleBtn");
    if (settleBtn) settleBtn.onclick = async () => {
      if (!confirm(`Mark ${money(d.debt, 0, d)} as paid and reset the ledger?`)) return;
      try { render(await api("settle", {})); toast("Settled. Debt reset ✓"); }
      catch (e) { toast(e.message); }
    };

    document.querySelectorAll(".reacts button").forEach((b) => {
      b.onclick = async () => {
        try { render(await api("react", { date: d.today, emoji: b.dataset.emoji })); toast(`${b.dataset.emoji} sent`); }
        catch (e) { toast(e.message); }
      };
    });

    const copyInvite = document.getElementById("copyInvite");
    if (copyInvite) copyInvite.onclick = async () => {
      const inp = document.getElementById("inviteInput");
      try { await navigator.clipboard.writeText(inp.value); } catch (_) { inp.select(); document.execCommand("copy"); }
      toast("Invite link copied 📋");
    };

    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) shareBtn.onclick = async () => {
      const text = d.debt > 0
        ? `😅 I owe ${d.partner_name} ${money(d.debt, 0, d)} for skipping "${d.habit}". Streak: ${d.streak} days.`
        : `🔥 ${d.streak}-day streak on "${d.habit}" — ${d.partner_name} earned nothing off me. Penalty Partner.`;
      api("share").catch(() => {}); // fire-and-forget virality signal
      const shareData = { title: "Penalty Partner", text, url: location.origin };
      if (navigator.share) { try { await navigator.share(shareData); } catch (_) {} }
      else { try { await navigator.clipboard.writeText(text + " " + location.origin); toast("Copied — paste it anywhere 📣"); } catch (_) { toast(text); } }
    };
  }

  if (!id || !token) {
    app.innerHTML = `<div class="brand"><span class="logo">🏋️</span> Penalty Partner</div><p class="msg err">This link is missing its access token. Ask for the full invite link.</p><p class="msg"><a href="/">Create your own challenge →</a></p>`;
    return;
  }

  api("get")
    .then(render)
    .catch((e) => {
      app.innerHTML = `<div class="brand"><span class="logo">🏋️</span> Penalty Partner</div><p class="msg err">${esc(e.message)}</p><p class="msg"><a href="/">Create a challenge →</a></p>`;
    });
})();
