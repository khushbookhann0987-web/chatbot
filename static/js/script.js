(() => {
  "use strict";

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const log = $("log");
  const form = $("composer");
  const input = $("input");
  const sendBtn = $("sendBtn");
  const tracker = $("tracker");
  const clearBtn = $("clearBtn");

  // ---------- State ----------
  let history = [];        // [{role, content}]
  let busy = false;
  let config = { botName: "Sprint" };

  // ---------- Tracker: Ask -> Working -> Answered ----------
  const setTracker = (state) => { tracker.dataset.state = state; };

  // ---------- Safe, minimal Markdown ----------
  function renderMarkdown(src) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const inline = (s) =>
      esc(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
          '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

    let html = "";
    let list = null;
    let para = [];

    const flushPara = () => {
      if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; }
    };
    const flushList = () => {
      if (list) {
        html += `<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`;
        list = null;
      }
    };

    for (const raw of src.replace(/\r/g, "").split("\n")) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flushPara(); flushList(); continue; }

      if ((m = line.match(/^\s*[-*\u2022]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
        flushPara(); flushList();
        html += `<p><strong>${inline(m[1])}</strong></p>`;
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
    return html;
  }

  // ---------- DOM helpers ----------
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function addUser(text) {
    const row = document.createElement("div");
    row.className = "msg msg--user";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    scrollDown();
  }

  function addBot() {
    const row = document.createElement("div");
    row.className = "msg msg--bot";
    row.innerHTML =
      '<div class="msg__avatar" aria-hidden="true">S</div>' +
      '<div class="bubble"><span class="typing" aria-label="Sprint is typing"><i></i><i></i><i></i></span></div>';
    log.appendChild(row);
    scrollDown();
    return { row, bubble: row.querySelector(".bubble") };
  }

  function showError(bot, message) {
    bot.row.classList.add("msg--error");
    bot.bubble.textContent = message;
  }

  function removeWelcome() {
    const w = $("welcome");
    if (w) w.remove();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  function setBusy(state) {
    busy = state;
    sendBtn.disabled = state;
    input.disabled = state;
    if (!state) input.focus();
  }

  // ---------- Sending ----------
  async function send(text) {
    text = text.trim();
    if (!text || busy) return;

    removeWelcome();
    addUser(text);
    history.push({ role: "user", content: text });

    input.value = "";
    autosize();
    setBusy(true);
    setTracker("progress");

    const bot = addBot();
    let reply = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { msg = (await res.json()).error || msg; } catch (_) { /* keep default */ }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const evt = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          for (const line of evt.split("\n")) {
            if (!line.startsWith("data:")) continue;
            let data;
            try { data = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }

            if (data.error) throw new Error(data.error);
            if (data.token) {
              reply += data.token;
              const stick = nearBottom();
              bot.bubble.innerHTML = renderMarkdown(reply);
              if (stick) scrollDown();
            }
            if (data.done) finished = true;
          }
        }
      }

      if (!reply.trim()) throw new Error("The model returned an empty reply. Please try again.");

      history.push({ role: "assistant", content: reply });
      setTracker("done");
    } catch (err) {
      showError(bot, err.message || "Something went wrong. Please try again.");
      // Drop the unanswered question so a retry doesn't send it twice.
      if (history.length && history[history.length - 1].role === "user") history.pop();
      setTracker("todo");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });

  input.addEventListener("input", () => {
    autosize();
    if (!busy && tracker.dataset.state === "done") setTracker("todo");
  });

  clearBtn.addEventListener("click", () => {
    if (busy) return;
    history = [];
    log.innerHTML = "";
    log.appendChild(buildWelcome());
    setTracker("todo");
    input.focus();
  });

  // ---------- Welcome screen ----------
  function buildWelcome() {
    const wrap = document.createElement("div");
    wrap.className = "welcome";
    wrap.id = "welcome";

    const h = document.createElement("h2");
    h.textContent = `Hi, I'm ${config.botName}.`;
    const p = document.createElement("p");
    p.textContent = config.greeting || "";
    const ul = document.createElement("ul");
    ul.className = "tasks";

    (config.suggestions || []).forEach((q) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", () => send(q));
      li.appendChild(b);
      ul.appendChild(li);
    });

    wrap.append(h, p, ul);
    return wrap;
  }

  // ---------- Profile panel ----------
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  function fillProfile() {
    $("ownerName").textContent = config.ownerName;
    $("ownerRole").textContent = config.ownerRole;
    $("tagline").textContent = config.tagline;
    $("botName").textContent = config.botName;
    $("portraitFallback").textContent = initials(config.ownerName);
    document.title = `${config.botName} | ${config.ownerName}'s portfolio assistant`;

    const img = $("portraitImg");
    img.onload = () => { img.hidden = false; $("portraitFallback").hidden = true; };
    img.onerror = () => { img.hidden = true; $("portraitFallback").hidden = false; };
    img.alt = `Portrait of ${config.ownerName}`;
    img.src = config.photo;

    const skills = $("skills");
    skills.innerHTML = "";
    (config.skills || []).forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      skills.appendChild(li);
    });

    const links = $("links");
    links.innerHTML = "";
    (config.links || []).forEach((l) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.label;
      li.appendChild(a);
      links.appendChild(li);
    });

    if (config.maxChars) input.maxLength = config.maxChars;
  }

  // ---------- Start ----------
  async function init() {
    try {
      const res = await fetch("/api/config");
      config = await res.json();
      fillProfile();
    } catch (_) {
      config = { botName: "Sprint", ownerName: "Khushboo Khan", ownerRole: "Project Manager",
                 greeting: "Ask me about Khushboo's projects, tools and experience.", suggestions: [], skills: [], links: [] };
      fillProfile();
    }
    const old = $("welcome");
    if (old) old.replaceWith(buildWelcome());
    input.focus();
  }

  init();
})();
