const starters = ["魔力猫在哪个蛋组？", "龙组有哪些精灵？", "老马有什么可以交换？", "伊兰亚龙能和哪些蛋组相关？"];
const viewTitles = {
  assistant: "助手问答",
  spirits: "精灵资料",
  groups: "蛋组浏览",
  exchange: "交换记录"
};

const state = {
  activeView: "assistant",
  data: { spirits: [], groups: [], exchange: [] },
  latestResults: { spirits: [], groups: [], exchange: [], totals: { spirits: 0, groups: 0, exchange: 0 } },
  messages: [
    {
      role: "assistant",
      content: "资料已就绪。"
    }
  ],
  chatting: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  lookup: $("#lookup"),
  password: $("#password"),
  chatInput: $("#chatInput"),
  chatForm: $("#chatForm"),
  sendBtn: $("#sendBtn"),
  messages: $("#messages"),
  status: $("#status"),
  quickList: $("#quickList"),
  resultMeta: $("#resultMeta"),
  spirits: $("#spirits"),
  groups: $("#groups"),
  exchange: $("#exchange"),
  viewTitle: $("#viewTitle"),
  spiritTable: $("#spiritTable"),
  groupGrid: $("#groupGrid"),
  exchangeList: $("#exchangeList"),
  spiritCount: $("#spiritCount"),
  groupCount: $("#groupCount"),
  exchangeCount: $("#exchangeCount"),
  assistantMeta: $("#assistantMeta"),
  spiritMeta: $("#spiritMeta"),
  groupMeta: $("#groupMeta"),
  exchangeMeta: $("#exchangeMeta"),
  modelStatus: $("#modelStatus")
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tagsHtml(tags) {
  if (!tags?.length) return "";
  return `<div class="tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function resultCard(title, body, tags = []) {
  return `
    <article class="result-card">
      <strong>${escapeHtml(title)}</strong>
      ${body ? `<p>${escapeHtml(body)}</p>` : ""}
      ${tagsHtml(tags)}
    </article>
  `;
}

function setView(view) {
  state.activeView = view;
  elements.viewTitle.textContent = viewTitles[view];
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  ["assistant", "spirits", "groups", "exchange"].forEach((name) => {
    $(`#${name}View`).classList.toggle("hidden", name !== view);
  });
}

function renderMessages() {
  elements.messages.innerHTML = state.messages
    .map((message) => {
      const label = message.role === "user" ? "我" : "洛";
      const order = message.role === "user"
        ? `<div class="bubble">${escapeHtml(message.content)}</div><div class="avatar">${label}</div>`
        : `<div class="avatar">${label}</div><div class="bubble">${escapeHtml(message.content)}</div>`;
      return `<div class="message ${message.role}">${order}</div>`;
    })
    .join("");
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderInspector(data) {
  elements.resultMeta.textContent = `资料总量：${data.totals.spirits} 精灵 / ${data.totals.groups} 蛋组 / ${data.totals.exchange} 交换记录`;

  if (!data.query) {
    elements.spirits.innerHTML = `<p class="empty">输入关键词后显示精灵匹配</p>`;
    elements.groups.innerHTML = `<p class="empty">输入关键词后显示蛋组匹配</p>`;
    elements.exchange.innerHTML = `<p class="empty">输入关键词后显示交换记录</p>`;
    return;
  }

  elements.spirits.innerHTML = data.spirits.length
    ? data.spirits.map((item) => resultCard(item.name, "", item.eggGroups)).join("")
    : `<p class="empty">没有匹配精灵</p>`;

  elements.groups.innerHTML = data.groups.length
    ? data.groups.map((item) => resultCard(item.name, item.spirits.slice(0, 12).join("、"))).join("")
    : `<p class="empty">没有匹配蛋组</p>`;

  elements.exchange.innerHTML = data.exchange.length
    ? data.exchange
        .map((item) =>
          resultCard(
            `${item.id} · ${item.spirit}`,
            [item.gender, item.eggGroups.join(" / "), item.nature, item.note].filter(Boolean).join(" · ")
          )
        )
        .join("")
    : `<p class="empty">没有匹配交换记录</p>`;
}

function renderDataViews() {
  const { spirits, groups, exchange } = state.data;
  const exchangeBySpirit = new Map();
  exchange.forEach((item) => {
    if (!exchangeBySpirit.has(item.spirit)) exchangeBySpirit.set(item.spirit, []);
    exchangeBySpirit.get(item.spirit).push(item);
  });

  elements.spiritCount.textContent = `${spirits.length} 精灵`;
  elements.groupCount.textContent = `${groups.length} 蛋组`;
  elements.exchangeCount.textContent = `${exchange.length} 记录`;
  const summary = `${spirits.length} 精灵 / ${groups.length} 蛋组 / ${exchange.length} 交换记录`;
  elements.assistantMeta.textContent = summary;
  elements.spiritMeta.textContent = summary;
  elements.groupMeta.textContent = summary;
  elements.exchangeMeta.textContent = summary;

  elements.spiritTable.innerHTML = spirits
    .map((spirit) => {
      const exchangeRows = exchangeBySpirit.get(spirit.name) || [];
      const exchangeText = exchangeRows.length ? exchangeRows.map((item) => `${item.id} ${item.gender || ""} ${item.nature || ""}`).join("；") : "暂无";
      return `
        <tr>
          <td><strong>${escapeHtml(spirit.name)}</strong></td>
          <td>${tagsHtml(spirit.eggGroups)}</td>
          <td>${escapeHtml(exchangeText)}</td>
        </tr>
      `;
    })
    .join("");

  elements.groupGrid.innerHTML = groups
    .map(
      (group) => `
        <article class="group-card">
          <strong>${escapeHtml(group.name)}</strong>
          <p>${escapeHtml(group.spirits.slice(0, 18).join("、"))}${group.spirits.length > 18 ? "..." : ""}</p>
          <button type="button" data-group="${escapeHtml(group.name)}">筛选这个蛋组</button>
        </article>
      `
    )
    .join("");

  elements.exchangeList.innerHTML = exchange.length
    ? exchange
        .map(
          (item) => `
            <article class="exchange-card">
              <strong>${escapeHtml(item.id)} · ${escapeHtml(item.spirit)}</strong>
              <p>${escapeHtml([item.gender, item.eggGroups.join(" / "), item.nature, item.note].filter(Boolean).join(" · "))}</p>
            </article>
          `
        )
        .join("")
    : `<p class="empty">当前 Excel 录入表里还没有更多交换记录。</p>`;

  elements.groupGrid.querySelectorAll("button[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.lookup.value = button.dataset.group;
      runSearch(button.dataset.group);
      setView("spirits");
    });
  });
}

async function runSearch(query) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=18`);
  const data = await response.json();
  state.latestResults = data;
  renderInspector(data);
}

async function loadData() {
  const response = await fetch("/api/data");
  state.data = await response.json();
  renderDataViews();
}

async function submitChat(forcedMessage) {
  const message = String(forcedMessage || elements.chatInput.value || "").trim();
  if (!message || state.chatting) return;

  setView("assistant");
  state.messages.push({ role: "user", content: message });
  elements.chatInput.value = "";
  state.chatting = true;
  elements.status.textContent = "思考中";
  elements.sendBtn.disabled = true;
  renderMessages();
  await runSearch(message);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        history: state.messages.slice(0, -1),
        password: elements.password.value
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `接口返回 ${response.status}`);
    }
    elements.modelStatus.textContent = data.mode === "llm" ? "模型回答已启用" : "本地摘要模式";
    if (data.warning) {
      elements.modelStatus.textContent = data.warning;
    }
    state.messages.push({ role: "assistant", content: data.answer || data.error || "这次没有拿到可用回答。" });
  } catch (error) {
    const detail = error?.message ? `（${error.message}）` : "";
    state.messages.push({ role: "assistant", content: `接口暂时不可用${detail}，可以先用右侧资料查询。` });
  } finally {
    state.chatting = false;
    elements.status.textContent = "就绪";
    elements.sendBtn.disabled = false;
    renderMessages();
  }
}

function wireEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#newChat").addEventListener("click", () => {
    state.messages = [{ role: "assistant", content: "新对话已开始。" }];
    renderMessages();
    setView("assistant");
  });

  let searchTimer;
  elements.lookup.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(elements.lookup.value), 120);
  });

  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitChat();
  });

  elements.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitChat();
    }
  });

  elements.quickList.innerHTML = starters.map((item) => `<button type="button">${escapeHtml(item)}</button>`).join("");
  elements.quickList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => submitChat(button.textContent));
  });
}

wireEvents();
renderMessages();
await loadData();
await runSearch("");
