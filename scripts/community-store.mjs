import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const localStorePath = path.join(projectRoot, "data", "community-exchange.json");
const defaultStore = {
  version: 1,
  updatedAt: "",
  users: [],
  entries: []
};

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, limit = 80) {
  return String(value || "").trim().slice(0, limit);
}

function normalizeStore(store) {
  return {
    version: 1,
    updatedAt: store?.updatedAt || "",
    users: Array.isArray(store?.users) ? store.users : [],
    entries: Array.isArray(store?.entries) ? store.entries : []
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function githubConfig() {
  const repo = process.env.COMMUNITY_GITHUB_REPO?.trim();
  const token = process.env.COMMUNITY_GITHUB_TOKEN?.trim();
  if (!repo || !token) return null;
  return {
    repo,
    token,
    branch: process.env.COMMUNITY_GITHUB_BRANCH?.trim() || "main",
    path: process.env.COMMUNITY_GITHUB_PATH?.trim() || "data/community-exchange.json"
  };
}

async function readGithubStore(config) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${encodeURIComponent(config.path).replaceAll("%2F", "/")}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "user-agent": "rock-kingdom-assistant"
    }
  });

  if (response.status === 404) {
    return { store: { ...defaultStore }, sha: null };
  }
  if (!response.ok) {
    throw new Error(`GitHub store read failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = Buffer.from(String(payload.content || ""), "base64").toString("utf8");
  return {
    store: normalizeStore(JSON.parse(content)),
    sha: payload.sha
  };
}

async function writeGithubStore(config, store, sha) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${encodeURIComponent(config.path).replaceAll("%2F", "/")}`;
  const body = {
    message: "Update community exchange data",
    branch: config.branch,
    content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
    ...(sha ? { sha } : {})
  };
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      "user-agent": "rock-kingdom-assistant"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`GitHub store write failed: ${response.status} ${await response.text()}`);
  }
}

export async function readCommunityStore() {
  const config = githubConfig();
  if (config) {
    const { store } = await readGithubStore(config);
    return normalizeStore(store);
  }

  try {
    const content = await fs.readFile(localStorePath, "utf8");
    return normalizeStore(JSON.parse(content));
  } catch {
    return { ...defaultStore };
  }
}

async function writeCommunityStore(store) {
  const normalized = normalizeStore(store);
  normalized.updatedAt = nowIso();
  const config = githubConfig();

  if (config) {
    const latest = await readGithubStore(config);
    await writeGithubStore(config, normalized, latest.sha);
    return normalized;
  }

  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

function sanitizeUser(input, existingUser) {
  const name = cleanText(input?.name, 24);
  if (!name) throw new Error("用户名不能为空");
  return {
    id: existingUser?.id || cleanText(input?.id, 80) || uid("user"),
    name,
    createdAt: existingUser?.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function sanitizeEntry(input, existingEntry, owner) {
  const spirit = cleanText(input?.spirit, 40);
  if (!spirit) throw new Error("精灵名不能为空");
  return {
    id: existingEntry?.id || cleanText(input?.id, 80) || uid("entry"),
    ownerId: owner.id,
    ownerName: owner.name,
    spirit,
    gender: cleanText(input?.gender, 8),
    nature: cleanText(input?.nature, 20),
    level: cleanText(input?.level, 10),
    eggGroups: Array.isArray(input?.eggGroups) ? input.eggGroups.map((item) => cleanText(item, 20)).filter(Boolean) : [],
    stats: {
      hp: cleanText(input?.stats?.hp, 12),
      attack: cleanText(input?.stats?.attack, 12),
      magicAttack: cleanText(input?.stats?.magicAttack, 12),
      defense: cleanText(input?.stats?.defense, 12),
      magicDefense: cleanText(input?.stats?.magicDefense, 12),
      speed: cleanText(input?.stats?.speed, 12)
    },
    note: cleanText(input?.note, 160),
    createdAt: existingEntry?.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

export async function saveCommunityUser(input) {
  const store = await readCommunityStore();
  const userIndex = store.users.findIndex((user) => user.id === input?.id);
  const user = sanitizeUser(input, userIndex === -1 ? null : store.users[userIndex]);
  if (userIndex === -1) store.users.push(user);
  else store.users[userIndex] = user;

  store.entries = store.entries.map((entry) =>
    entry.ownerId === user.id ? { ...entry, ownerName: user.name, updatedAt: nowIso() } : entry
  );
  return writeCommunityStore(store);
}

export async function saveCommunityEntry(input) {
  const store = await readCommunityStore();
  const owner = store.users.find((user) => user.id === input?.ownerId);
  if (!owner) throw new Error("请先创建用户名");
  const entryIndex = store.entries.findIndex((entry) => entry.id === input?.id);
  if (entryIndex !== -1 && store.entries[entryIndex].ownerId !== owner.id) {
    throw new Error("不能编辑其他用户的记录");
  }
  const entry = sanitizeEntry(input, entryIndex === -1 ? null : store.entries[entryIndex], owner);
  if (entryIndex === -1) store.entries.push(entry);
  else store.entries[entryIndex] = entry;
  return writeCommunityStore(store);
}

export async function deleteCommunityEntry(input) {
  const store = await readCommunityStore();
  const id = cleanText(input?.id, 80);
  const ownerId = cleanText(input?.ownerId, 80);
  store.entries = store.entries.filter((entry) => !(entry.id === id && entry.ownerId === ownerId));
  return writeCommunityStore(store);
}
