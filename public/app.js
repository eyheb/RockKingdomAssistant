const starters = ["魔力猫在哪个蛋组？", "龙组有哪些精灵？", "老马有什么可以交换？", "伊兰亚龙能和哪些蛋组相关？"];
const stageOrder = ["Ⅰ阶", "Ⅱ阶", "最终形态"];
const typeOrder = ["普通", "草", "火", "水", "光", "地", "冰", "龙", "电", "毒", "幽", "武", "翼", "萌", "幻", "恶", "机械", "虫"];
const specialOptions = [
  { value: "地区形态", label: "地区形态" },
  { value: "首领形态", label: "首领形态" }
];
const shinyOptions = [
  { value: "yes", label: "有异色" },
  { value: "no", label: "没异色" }
];
const legacyOwnerStorageKey = "rock-assistant-community-user-id";
const ownerStorageKey = "rock-kingdom-assistant-community-user-id";
if (!localStorage.getItem(ownerStorageKey) && localStorage.getItem(legacyOwnerStorageKey)) {
  localStorage.setItem(ownerStorageKey, localStorage.getItem(legacyOwnerStorageKey));
}

const viewTitles = {
  assistant: "助手问答",
  spirits: "精灵资料",
  groups: "蛋组浏览",
  exchange: "交换记录",
  detail: "精灵详情"
};

const state = {
  activeView: "assistant",
  data: { spirits: [], groups: [], exchange: [], biligameDex: [], biligameDetails: [] },
  latestResults: { spirits: [], dex: [], groups: [], exchange: [], totals: { spirits: 0, dex: 0, details: 0, groups: 0, exchange: 0 } },
  messages: [
    {
      role: "assistant",
      content: "资料已就绪。"
    }
  ],
  chatting: false,
  dexFilters: {
    query: "",
    stages: new Set(),
    types: new Set(),
    specials: new Set(),
    shiny: "",
    eggGroup: "",
    sort: "number"
  },
  selectedSpiritUrl: ""
  ,
  community: { users: [], entries: [], updatedAt: "" },
  communityFilter: "",
  currentUserId: localStorage.getItem(ownerStorageKey) || ""
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
  spiritSearch: $("#spiritSearch"),
  dexEggGroup: $("#dexEggGroup"),
  dexSort: $("#dexSort"),
  dexReset: $("#dexReset"),
  dexStageFilters: $("#dexStageFilters"),
  dexSpecialFilters: $("#dexSpecialFilters"),
  dexShinyFilters: $("#dexShinyFilters"),
  dexTypeFilters: $("#dexTypeFilters"),
  dexResultCount: $("#dexResultCount"),
  dexActiveFilters: $("#dexActiveFilters"),
  dexGrid: $("#dexGrid"),
  detailView: $("#detailView"),
  detailContent: $("#detailContent"),
  groupGrid: $("#groupGrid"),
  communityUserForm: $("#communityUserForm"),
  communityUserName: $("#communityUserName"),
  communityUserMeta: $("#communityUserMeta"),
  communityEntryForm: $("#communityEntryForm"),
  entryId: $("#entryId"),
  entrySpirit: $("#entrySpirit"),
  entryGender: $("#entryGender"),
  entryNature: $("#entryNature"),
  entryLevel: $("#entryLevel"),
  entryEggGroups: $("#entryEggGroups"),
  entryHp: $("#entryHp"),
  entryAttack: $("#entryAttack"),
  entryMagicAttack: $("#entryMagicAttack"),
  entryDefense: $("#entryDefense"),
  entryMagicDefense: $("#entryMagicDefense"),
  entrySpeed: $("#entrySpeed"),
  entryNote: $("#entryNote"),
  entryReset: $("#entryReset"),
  exchangeFilter: $("#exchangeFilter"),
  exchangeRefresh: $("#exchangeRefresh"),
  exchangeTableBody: $("#exchangeTableBody"),
  spiritNameList: $("#spiritNameList"),
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

function splitList(value) {
  return String(value || "")
    .split(/[,\s，、/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentUser() {
  return state.community.users.find((user) => user.id === state.currentUserId) || null;
}

function statText(stats = {}) {
  return [
    stats.hp ? `生${stats.hp}` : "",
    stats.attack ? `物${stats.attack}` : "",
    stats.magicAttack ? `魔${stats.magicAttack}` : "",
    stats.defense ? `物防${stats.defense}` : "",
    stats.magicDefense ? `魔防${stats.magicDefense}` : "",
    stats.speed ? `速${stats.speed}` : ""
  ].filter(Boolean).join(" / ");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function compareByDefinedOrder(a, b, order) {
  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN");
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function typeBadgeHtml(type) {
  return `<span class="type-badge" data-type="${escapeHtml(type)}">${escapeHtml(type)}</span>`;
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
  ["assistant", "spirits", "detail", "groups", "exchange"].forEach((name) => {
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
  elements.resultMeta.textContent = `资料总量：${data.totals.spirits} 蛋组精灵 / ${data.totals.dex || 0} 图鉴 / ${data.totals.details || 0} 详情 / ${data.totals.groups} 蛋组 / ${data.totals.exchange} 交换记录`;

  if (!data.query) {
    elements.spirits.innerHTML = `<p class="empty">输入关键词后显示精灵匹配</p>`;
    elements.groups.innerHTML = `<p class="empty">输入关键词后显示蛋组匹配</p>`;
    elements.exchange.innerHTML = `<p class="empty">输入关键词后显示交换记录</p>`;
    return;
  }

  elements.spirits.innerHTML = data.spirits.length
    ? data.spirits.map((item) => resultCard(item.name, "", item.eggGroups)).join("")
      + data.dex.map((item) => resultCard(`NO.${item.number} · ${item.name}`, [item.stage, item.form, item.types.join(" / ")].filter(Boolean).join(" · "), item.types)).join("")
    : data.dex.length
      ? data.dex.map((item) => resultCard(`NO.${item.number} · ${item.name}`, [item.stage, item.form, item.types.join(" / ")].filter(Boolean).join(" · "), item.types)).join("")
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
  const { spirits, groups, exchange, biligameDex = [], biligameDetails = [] } = state.data;
  elements.spiritCount.textContent = `${spirits.length} 蛋组精灵 / ${biligameDex.length} 图鉴`;
  elements.groupCount.textContent = `${groups.length} 蛋组`;
  elements.exchangeCount.textContent = `${exchange.length} 记录`;
  const summary = `${spirits.length} 蛋组精灵 / ${biligameDex.length} 图鉴 / ${biligameDetails.length} 详情 / ${groups.length} 蛋组 / ${exchange.length} 交换记录`;
  elements.assistantMeta.textContent = summary;
  elements.spiritMeta.textContent = summary;
  elements.groupMeta.textContent = summary;
  elements.exchangeMeta.textContent = summary;

  renderDexControls();
  renderDexGrid();
  renderCommunityExchange();

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

  elements.groupGrid.querySelectorAll("button[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.lookup.value = button.dataset.group;
      state.dexFilters.eggGroup = button.dataset.group;
      elements.dexEggGroup.value = button.dataset.group;
      renderDexGrid();
      runSearch(button.dataset.group);
      setView("spirits");
    });
  });
}

function getEggGroupsBySpirit() {
  const map = new Map();
  state.data.spirits.forEach((item) => {
    map.set(item.name, item.eggGroups || []);
  });
  return map;
}

function getExchangeBySpirit() {
  const map = new Map();
  getAllExchangeEntries().forEach((item) => {
    if (!map.has(item.spirit)) map.set(item.spirit, []);
    map.get(item.spirit).push(item);
  });
  return map;
}

function getAllExchangeEntries() {
  return state.community.entries?.length ? state.community.entries : state.data.exchange;
}

function getSpiritByName(name) {
  return (state.data.spirits || []).find((item) => item.name === name) || null;
}

async function loadCommunityExchange() {
  const response = await fetch("/api/community-exchange");
  if (!response.ok) throw new Error(`交换表读取失败：${response.status}`);
  state.community = await response.json();
  if (!currentUser() && state.community.users?.[0] && !state.currentUserId) {
    state.currentUserId = "";
  }
  renderCommunityExchange();
}

async function saveCommunity(payload) {
  const response = await fetch("/api/community-exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `交换表保存失败：${response.status}`);
  state.community = data;
  state.data.exchange = data.entries || [];
  renderDataViews();
  await runSearch(elements.lookup.value);
}

function populateSpiritList() {
  const names = [...new Set([...(state.data.biligameDex || []).map((item) => item.name), ...(state.data.spirits || []).map((item) => item.name)])]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  elements.spiritNameList.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function renderCommunityExchange() {
  if (!elements.exchangeTableBody) return;
  const user = currentUser();
  const entries = getAllExchangeEntries();
  const query = normalize(state.communityFilter);
  const filtered = entries.filter((entry) => {
    if (!query) return true;
    return [
      entry.ownerName,
      entry.id,
      entry.spirit,
      entry.gender,
      entry.nature,
      entry.level,
      entry.note,
      ...(entry.eggGroups || []),
      ...Object.values(entry.stats || {})
    ].some((field) => normalize(field).includes(query));
  });

  elements.exchangeCount.textContent = `${entries.length} 记录`;
  elements.exchangeMeta.textContent = user
    ? `${user.name} · ${entries.length} 条共享记录`
    : `${entries.length} 条共享记录 · 先创建用户名再录入`;
  elements.communityUserName.value = user?.name || "";
  elements.communityUserMeta.textContent = user ? `当前用户：${user.name}` : "未创建用户名";

  elements.exchangeTableBody.innerHTML = filtered.length
    ? filtered.map((entry) => {
        const canEdit = user && entry.ownerId === user.id;
        return `
          <tr>
            <td>${escapeHtml(entry.ownerName || entry.id || "")}</td>
            <td><strong>${escapeHtml(entry.spirit)}</strong></td>
            <td>${escapeHtml(entry.gender || "-")}</td>
            <td>${escapeHtml(entry.nature || "-")}</td>
            <td>${escapeHtml(entry.level || "-")}</td>
            <td>${tagsHtml(entry.eggGroups || [])}</td>
            <td>${escapeHtml(statText(entry.stats) || "-")}</td>
            <td>${escapeHtml(entry.note || "")}</td>
            <td>
              <div class="row-actions">
                ${canEdit ? `<button type="button" data-edit-entry="${escapeHtml(entry.id)}">编辑</button><button type="button" data-delete-entry="${escapeHtml(entry.id)}">删除</button>` : `<span class="muted-action">只读</span>`}
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="9"><p class="empty">没有匹配记录。</p></td></tr>`;
}

function syncEggGroupsFromSpirit() {
  const spirit = getSpiritByName(elements.entrySpirit.value);
  if (spirit && !elements.entryEggGroups.value.trim()) {
    elements.entryEggGroups.value = spirit.eggGroups.join("、");
  }
}

function resetEntryForm() {
  elements.entryId.value = "";
  elements.entrySpirit.value = "";
  elements.entryGender.value = "";
  elements.entryNature.value = "";
  elements.entryLevel.value = "";
  elements.entryEggGroups.value = "";
  elements.entryHp.value = "";
  elements.entryAttack.value = "";
  elements.entryMagicAttack.value = "";
  elements.entryDefense.value = "";
  elements.entryMagicDefense.value = "";
  elements.entrySpeed.value = "";
  elements.entryNote.value = "";
}

function fillEntryForm(entry) {
  elements.entryId.value = entry.id || "";
  elements.entrySpirit.value = entry.spirit || "";
  elements.entryGender.value = entry.gender || "";
  elements.entryNature.value = entry.nature || "";
  elements.entryLevel.value = entry.level || "";
  elements.entryEggGroups.value = (entry.eggGroups || []).join("、");
  elements.entryHp.value = entry.stats?.hp || "";
  elements.entryAttack.value = entry.stats?.attack || "";
  elements.entryMagicAttack.value = entry.stats?.magicAttack || "";
  elements.entryDefense.value = entry.stats?.defense || "";
  elements.entryMagicDefense.value = entry.stats?.magicDefense || "";
  elements.entrySpeed.value = entry.stats?.speed || "";
  elements.entryNote.value = entry.note || "";
}

function getDetailsByUrl() {
  return new Map((state.data.biligameDetails || []).map((item) => [item.wikiUrl, item]));
}

function renderFilterButton(container, group, value, label) {
  const selected = group === "shiny"
    ? state.dexFilters.shiny === value
    : state.dexFilters[group].has(value);
  container.insertAdjacentHTML(
    "beforeend",
    `<button class="${selected ? "active" : ""}" type="button" data-filter-group="${group}" data-filter-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`
  );
}

function renderDexControls() {
  const { groups, biligameDex = [] } = state.data;
  const stages = stageOrder.filter((stage) => biligameDex.some((item) => item.stage === stage));
  const types = typeOrder.filter((type) => biligameDex.some((item) => item.types.includes(type)));
  const eggGroups = groups.map((group) => group.name).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  elements.spiritSearch.value = state.dexFilters.query;
  elements.dexSort.value = state.dexFilters.sort;
  elements.dexEggGroup.innerHTML = `<option value="">全部蛋组</option>${eggGroups.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  elements.dexEggGroup.value = state.dexFilters.eggGroup;

  elements.dexStageFilters.innerHTML = "";
  stages.forEach((stage) => renderFilterButton(elements.dexStageFilters, "stages", stage, stage));

  elements.dexSpecialFilters.innerHTML = "";
  specialOptions.forEach((option) => renderFilterButton(elements.dexSpecialFilters, "specials", option.value, option.label));

  elements.dexShinyFilters.innerHTML = "";
  shinyOptions.forEach((option) => renderFilterButton(elements.dexShinyFilters, "shiny", option.value, option.label));

  elements.dexTypeFilters.innerHTML = "";
  types.forEach((type) => renderFilterButton(elements.dexTypeFilters, "types", type, type));
}

function applyDexFilters(items) {
  const filters = state.dexFilters;
  const query = normalize(filters.query);
  const eggGroupsBySpirit = getEggGroupsBySpirit();
  const selectedStages = [...filters.stages];
  const selectedTypes = [...filters.types];
  const selectedSpecials = [...filters.specials];

  return items.filter((item) => {
    const eggGroups = eggGroupsBySpirit.get(item.name) || [];
    const searchable = [
      item.number,
      item.name,
      item.wikiTitle,
      item.stage,
      item.form,
      ...item.types,
      ...item.specialForms,
      ...eggGroups
    ].map(normalize);

    if (query && !searchable.some((field) => field.includes(query))) return false;
    if (selectedStages.length && !selectedStages.includes(item.stage)) return false;
    if (selectedTypes.length && !selectedTypes.some((type) => item.types.includes(type))) return false;
    if (selectedSpecials.length && !selectedSpecials.some((special) => item.specialForms.includes(special) || item.form === special)) return false;
    if (filters.shiny === "yes" && !item.hasShiny) return false;
    if (filters.shiny === "no" && item.hasShiny) return false;
    if (filters.eggGroup && !eggGroups.includes(filters.eggGroup)) return false;
    return true;
  });
}

function sortDexItems(items) {
  const sort = state.dexFilters.sort;
  return [...items].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "zh-Hans-CN") || Number(a.number) - Number(b.number);
    if (sort === "stage") return compareByDefinedOrder(a.stage, b.stage, stageOrder) || Number(a.number) - Number(b.number);
    if (sort === "type") return compareByDefinedOrder(a.types[0], b.types[0], typeOrder) || Number(a.number) - Number(b.number);
    if (sort === "form") return a.form.localeCompare(b.form, "zh-Hans-CN") || Number(a.number) - Number(b.number);
    return Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

function renderDexGrid() {
  const { biligameDex = [] } = state.data;
  const eggGroupsBySpirit = getEggGroupsBySpirit();
  const exchangeBySpirit = getExchangeBySpirit();
  const detailsByUrl = getDetailsByUrl();
  const filtered = sortDexItems(applyDexFilters(biligameDex));
  const active = [
    state.dexFilters.query ? `关键词：${state.dexFilters.query}` : "",
    state.dexFilters.eggGroup ? `蛋组：${state.dexFilters.eggGroup}` : "",
    ...[...state.dexFilters.stages].map((item) => `类型：${item}`),
    ...[...state.dexFilters.specials].map((item) => `形态：${item}`),
    ...[...state.dexFilters.types].map((item) => `属性：${item}`),
    state.dexFilters.shiny === "yes" ? "有异色" : "",
    state.dexFilters.shiny === "no" ? "没异色" : ""
  ].filter(Boolean);

  elements.dexResultCount.textContent = `${filtered.length} / ${biligameDex.length} 条`;
  elements.dexActiveFilters.innerHTML = active.length
    ? active.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : `<span>全部图鉴</span>`;

  if (!filtered.length) {
    elements.dexGrid.innerHTML = `<p class="empty dex-empty">没有匹配的精灵。</p>`;
    return;
  }

  elements.dexGrid.innerHTML = filtered
    .map((item) => {
      const eggGroups = eggGroupsBySpirit.get(item.name) || [];
      const exchangeRows = exchangeBySpirit.get(item.name) || [];
      const detail = detailsByUrl.get(item.wikiUrl);
      const exchangeText = exchangeRows.length
        ? exchangeRows.map((row) => `${row.id}${row.gender ? ` ${row.gender}` : ""}${row.nature ? ` ${row.nature}` : ""}`).join("；")
        : "";
      const detailText = detail?.stats?.total
        ? `种族值 ${detail.stats.total}${detail.characteristics?.[0]?.name ? ` · ${detail.characteristics[0].name}` : ""}`
        : "详情待导入";
      return `
        <article class="dex-card" data-wiki-url="${escapeHtml(item.wikiUrl)}">
          <button class="dex-art" type="button" data-wiki-url="${escapeHtml(item.wikiUrl)}" aria-label="查看${escapeHtml(item.name)}详情">
            <img src="${escapeHtml(item.thumbnailUrl || item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />
          </button>
          <div class="dex-card-body">
            <div class="dex-card-title">
              <span>NO.${escapeHtml(item.number)}</span>
              <strong>${escapeHtml(item.name)}</strong>
            </div>
            <div class="type-row">${item.types.map(typeBadgeHtml).join("")}</div>
            <dl class="dex-facts">
              <div><dt>阶段</dt><dd>${escapeHtml(item.stage || "未知")}</dd></div>
              <div><dt>形态</dt><dd>${escapeHtml(item.form || "原始形态")}</dd></div>
              <div><dt>异色</dt><dd>${item.hasShiny ? "有" : "无"}</dd></div>
              <div><dt>蛋组</dt><dd>${eggGroups.length ? escapeHtml(eggGroups.join(" / ")) : "暂无"}</dd></div>
            </dl>
            <p class="dex-detail-line">${escapeHtml(detailText)}</p>
            ${exchangeText ? `<p class="dex-note">${escapeHtml(exchangeText)}</p>` : ""}
            <button class="dex-open-detail" type="button" data-wiki-url="${escapeHtml(item.wikiUrl)}">查看详情</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function statRowsHtml(stats = {}) {
  const rows = [
    ["生命", stats.hp],
    ["物攻", stats.physicalAttack],
    ["魔攻", stats.magicAttack],
    ["物防", stats.physicalDefense],
    ["魔防", stats.magicDefense],
    ["速度", stats.speed]
  ];
  return rows
    .map(([label, value]) => {
      const width = Math.max(8, Math.min(100, Number(value || 0) / 2));
      return `
        <div class="stat-row">
          <span>${label}</span>
          <div><i style="width:${width}%"></i></div>
          <strong>${value || "-"}</strong>
        </div>
      `;
    })
    .join("");
}

function renderDetailView(wikiUrl) {
  const dex = (state.data.biligameDex || []).find((item) => item.wikiUrl === wikiUrl);
  const detail = getDetailsByUrl().get(wikiUrl);
  const eggGroups = getEggGroupsBySpirit().get(dex?.name) || [];

  if (!dex) {
    window.open(wikiUrl, "_blank", "noopener,noreferrer");
    return;
  }
  state.selectedSpiritUrl = wikiUrl;
  setView("detail");

  if (!detail) {
    elements.detailContent.innerHTML = `
      <div class="detail-empty">
        <div class="detail-actions">
          <button class="link-button" id="backToDex" type="button">返回图鉴</button>
          <a class="source-button" href="${escapeHtml(dex.wikiUrl)}" target="_blank" rel="noreferrer">来源页面</a>
        </div>
        <p>这只精灵还没有导入详情数据。</p>
      </div>
    `;
    $("#backToDex").addEventListener("click", () => setView("spirits"));
    return;
  }

  elements.detailContent.innerHTML = `
    <div class="detail-hero">
      <div class="detail-actions">
        <button class="link-button" id="backToDex" type="button">返回图鉴</button>
        <a class="source-button" href="${escapeHtml(dex.wikiUrl)}" target="_blank" rel="noreferrer">来源页面</a>
      </div>
      <div class="detail-hero-main">
        <img src="${escapeHtml(dex.thumbnailUrl || dex.imageUrl)}" alt="${escapeHtml(dex.name)}" />
        <div>
          <p>NO.${escapeHtml(dex.number)}</p>
          <h2>${escapeHtml(dex.name)}</h2>
          <div class="type-row">${dex.types.map(typeBadgeHtml).join("")}</div>
          <p class="detail-summary">${escapeHtml(detail.description || "暂无简介")}</p>
        </div>
      </div>
    </div>

    <div class="detail-layout">
      <section class="detail-panel">
        <h3>基础资料</h3>
        <dl class="detail-facts">
          <div><dt>阶段</dt><dd>${escapeHtml(dex.stage || "未知")}</dd></div>
          <div><dt>形态</dt><dd>${escapeHtml(dex.form || "原始形态")}</dd></div>
          <div><dt>身高</dt><dd>${escapeHtml(detail.physique?.height || "未知")}</dd></div>
          <div><dt>体重</dt><dd>${escapeHtml(detail.physique?.weight || "未知")}</dd></div>
          <div><dt>分布</dt><dd>${escapeHtml(detail.distribution?.location || "未知")}</dd></div>
          <div><dt>分类</dt><dd>${escapeHtml(detail.distribution?.category || "未知")}</dd></div>
          <div><dt>蛋组</dt><dd>${eggGroups.length ? escapeHtml(eggGroups.join(" / ")) : "暂无"}</dd></div>
        </dl>
      </section>

      <section class="detail-panel">
        <h3>种族值 ${detail.stats?.total ? `<span>${detail.stats.total}</span>` : ""}</h3>
        <div class="stat-list">${statRowsHtml(detail.stats)}</div>
      </section>

      <section class="detail-panel">
        <h3>特性</h3>
        <div class="ability-list">
          ${detail.characteristics?.length
            ? detail.characteristics.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></article>`).join("")
            : `<p class="empty">暂无特性资料。</p>`}
        </div>
      </section>

      <section class="detail-panel">
        <h3>进化链</h3>
        <div class="evolution-list">
          ${detail.evolution?.chain?.length
            ? detail.evolution.chain.map((item, index) => `
                <button type="button" data-wiki-url="${escapeHtml(item.wikiUrl)}">
                  <img src="${escapeHtml(item.thumbnailUrl || item.imageUrl)}" alt="${escapeHtml(item.name)}" />
                  <span>${escapeHtml(item.name)}</span>
                  ${detail.evolution.levels?.[index - 1] ? `<small>Lv.${escapeHtml(detail.evolution.levels[index - 1])}</small>` : ""}
                </button>
              `).join("")
            : `<p class="empty">暂无进化链资料。</p>`}
        </div>
      </section>

      <section class="detail-panel">
        <h3>克制关系</h3>
        <dl class="detail-facts">
          <div><dt>克制</dt><dd>${detail.restraints?.strongAgainst?.length ? detail.restraints.strongAgainst.map(typeBadgeHtml).join("") : "暂无"}</dd></div>
          <div><dt>被克制</dt><dd>${detail.restraints?.weakAgainst?.length ? detail.restraints.weakAgainst.map(typeBadgeHtml).join("") : "暂无"}</dd></div>
        </dl>
      </section>

      <section class="detail-panel wide">
        <h3>技能列表 <span>${detail.skills?.length || 0}</span></h3>
        <div class="skill-table">
          ${detail.skills?.length
            ? detail.skills.map((skill) => `
                <article>
                  <strong>${escapeHtml(skill.name)}</strong>
                  <span>${escapeHtml([skill.level, skill.attribute, skill.category, skill.power ? `威力 ${skill.power}` : ""].filter(Boolean).join(" · "))}</span>
                  <p>${escapeHtml(skill.description)}</p>
                </article>
              `).join("")
            : `<p class="empty">暂无技能资料。</p>`}
        </div>
      </section>
    </div>
  `;
  $("#backToDex").addEventListener("click", () => setView("spirits"));
  elements.detailContent.querySelectorAll(".evolution-list button[data-wiki-url]").forEach((button) => {
    button.addEventListener("click", () => {
      renderDetailView(button.dataset.wikiUrl);
    });
  });
}

function toggleDexFilter(group, value) {
  if (group === "shiny") {
    state.dexFilters.shiny = state.dexFilters.shiny === value ? "" : value;
  } else if (state.dexFilters[group].has(value)) {
    state.dexFilters[group].delete(value);
  } else {
    state.dexFilters[group].add(value);
  }
  renderDexControls();
  renderDexGrid();
}

function resetDexFilters() {
  state.dexFilters.query = "";
  state.dexFilters.stages.clear();
  state.dexFilters.types.clear();
  state.dexFilters.specials.clear();
  state.dexFilters.shiny = "";
  state.dexFilters.eggGroup = "";
  state.dexFilters.sort = "number";
  renderDexControls();
  renderDexGrid();
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
    searchTimer = setTimeout(() => {
      if (state.activeView === "spirits") {
        state.dexFilters.query = elements.lookup.value;
        elements.spiritSearch.value = elements.lookup.value;
        renderDexGrid();
      }
      runSearch(elements.lookup.value);
    }, 120);
  });

  elements.spiritSearch.addEventListener("input", () => {
    state.dexFilters.query = elements.spiritSearch.value;
    renderDexGrid();
  });
  elements.dexEggGroup.addEventListener("change", () => {
    state.dexFilters.eggGroup = elements.dexEggGroup.value;
    renderDexGrid();
  });
  elements.dexSort.addEventListener("change", () => {
    state.dexFilters.sort = elements.dexSort.value;
    renderDexGrid();
  });
  elements.dexReset.addEventListener("click", resetDexFilters);
  [elements.dexStageFilters, elements.dexSpecialFilters, elements.dexShinyFilters, elements.dexTypeFilters].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter-group]");
      if (!button) return;
      toggleDexFilter(button.dataset.filterGroup, button.dataset.filterValue);
    });
  });
  elements.dexGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-wiki-url]");
    if (!button) return;
    renderDetailView(button.dataset.wikiUrl);
  });

  elements.communityUserForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = elements.communityUserName.value.trim();
    if (!name) return;
    const id = state.currentUserId || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await saveCommunity({ action: "saveUser", user: { id, name } });
    state.currentUserId = id;
    localStorage.setItem(ownerStorageKey, id);
    renderCommunityExchange();
  });

  elements.entrySpirit.addEventListener("change", syncEggGroupsFromSpirit);
  elements.entrySpirit.addEventListener("blur", syncEggGroupsFromSpirit);
  elements.entryReset.addEventListener("click", resetEntryForm);
  elements.exchangeFilter.addEventListener("input", () => {
    state.communityFilter = elements.exchangeFilter.value;
    renderCommunityExchange();
  });
  elements.exchangeRefresh.addEventListener("click", async () => {
    await loadCommunityExchange();
    await runSearch(elements.lookup.value);
  });
  elements.communityEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = currentUser();
    if (!user) {
      elements.communityUserMeta.textContent = "请先保存用户名";
      return;
    }
    const entry = {
      id: elements.entryId.value,
      ownerId: user.id,
      spirit: elements.entrySpirit.value,
      gender: elements.entryGender.value,
      nature: elements.entryNature.value,
      level: elements.entryLevel.value,
      eggGroups: splitList(elements.entryEggGroups.value),
      stats: {
        hp: elements.entryHp.value,
        attack: elements.entryAttack.value,
        magicAttack: elements.entryMagicAttack.value,
        defense: elements.entryDefense.value,
        magicDefense: elements.entryMagicDefense.value,
        speed: elements.entrySpeed.value
      },
      note: elements.entryNote.value
    };
    await saveCommunity({ action: "saveEntry", entry });
    resetEntryForm();
  });
  elements.exchangeTableBody.addEventListener("click", async (event) => {
    const editButton = event.target.closest("button[data-edit-entry]");
    const deleteButton = event.target.closest("button[data-delete-entry]");
    if (editButton) {
      const entry = getAllExchangeEntries().find((item) => item.id === editButton.dataset.editEntry);
      if (entry) fillEntryForm(entry);
      return;
    }
    if (deleteButton) {
      const user = currentUser();
      if (!user) return;
      await saveCommunity({ action: "deleteEntry", id: deleteButton.dataset.deleteEntry, ownerId: user.id });
      resetEntryForm();
    }
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
populateSpiritList();
await loadCommunityExchange();
await runSearch("");
