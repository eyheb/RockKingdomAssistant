import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const localStorePath = path.join(projectRoot, "data", "community-exchange.json");
const localWritableStorePath = path.join(projectRoot, ".community-exchange.local.json");
const defaultStore = {
  version: 2,
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
    version: 2,
    updatedAt: store?.updatedAt || "",
    users: Array.isArray(store?.users) ? store.users : [],
    entries: Array.isArray(store?.entries) ? store.entries.map(normalizeEntry) : []
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
    branch: process.env.COMMUNITY_GITHUB_BRANCH?.trim() || "community-data",
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
    const error = new Error(`GitHub store write failed: ${response.status} ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
}

export async function readCommunityStore() {
  const config = githubConfig();
  if (config) {
    const { store } = await readGithubStore(config);
    return normalizeStore(store);
  }

  try {
    const writableContent = await fs.readFile(localWritableStorePath, "utf8");
    return normalizeStore(JSON.parse(writableContent));
  } catch {
    // Fall back to the checked-in seed file when no local writable copy exists.
  }

  try {
    const content = await fs.readFile(localStorePath, "utf8");
    return normalizeStore(JSON.parse(content));
  } catch {
    return { ...defaultStore };
  }
}

async function writeLocalCommunityStore(store) {
  const normalized = normalizeStore(store);
  normalized.updatedAt = nowIso();

  try {
    await fs.mkdir(path.dirname(localStorePath), { recursive: true });
    await fs.writeFile(localStorePath, JSON.stringify(normalized, null, 2), "utf8");
  } catch {
    await fs.writeFile(localWritableStorePath, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

async function mutateCommunityStore(mutator) {
  const config = githubConfig();

  if (config) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = await readGithubStore(config);
      const draft = normalizeStore(latest.store);
      mutator(draft);
      const normalized = normalizeStore(draft);
      normalized.updatedAt = nowIso();

      try {
        await writeGithubStore(config, normalized, latest.sha);
        return normalized;
      } catch (error) {
        if (error.status === 409 && attempt < 2) continue;
        throw error;
      }
    }
  }

  const store = await readCommunityStore();
  mutator(store);
  return writeLocalCommunityStore(store);
}

function normalizeEntry(input) {
  return {
    id: cleanText(input?.id, 80) || uid("entry"),
    player: cleanText(input?.player || input?.ownerName || input?.owner || input?.id, 40),
    spirit: cleanText(input?.spirit, 40),
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
    createdAt: input?.createdAt || "",
    updatedAt: input?.updatedAt || ""
  };
}

function sanitizeEntry(input, existingEntry) {
  const player = cleanText(input?.player || input?.ownerName || input?.owner, 40);
  const spirit = cleanText(input?.spirit, 40);
  if (!player) throw new Error("玩家不能为空");
  if (!spirit) throw new Error("精灵名不能为空");
  return {
    id: existingEntry?.id || cleanText(input?.id, 80) || uid("entry"),
    player,
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

export async function saveCommunityEntry(input) {
  return mutateCommunityStore((store) => {
    const entryIndex = store.entries.findIndex((entry) => entry.id === input?.id);
    const entry = sanitizeEntry(input, entryIndex === -1 ? null : store.entries[entryIndex]);
    if (entryIndex === -1) store.entries.push(entry);
    else store.entries[entryIndex] = entry;
  });
}

export async function deleteCommunityEntry(input) {
  return mutateCommunityStore((store) => {
    const id = cleanText(input?.id, 80);
    store.entries = store.entries.filter((entry) => entry.id !== id);
  });
}
