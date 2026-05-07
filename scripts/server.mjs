import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { callModel as callSharedModel, loadDataAsync, searchKnowledgeAsync } from "./api-shared.mjs";
import {
  deleteCommunityEntry,
  readCommunityStore,
  saveCommunityEntry
} from "./community-store.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const publicRoot = path.join(projectRoot, "public");
loadEnvFile(path.join(projectRoot, ".env"));
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(publicRoot, relativePath);

  if (!filePath.startsWith(publicRoot)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "cache-control": [".html", ".css", ".js", ".svg"].includes(ext) ? "no-store" : "public, max-age=3600"
  });
  fs.createReadStream(filePath).pipe(response);
}

async function callModel(message, history) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    return { answer: localFallbackAnswer(message), mode: "local" };
  }

  const baseUrl = process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
  const results = searchKnowledge(message, 10);
  const context = formatResultsForPrompt(results);

  const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "你是一个洛克王国世界小范围朋友群使用的虚拟助手。优先依据提供的本地资料回答；资料不足时要明确说不确定，并建议用户补充数据。回答用简洁中文。"
        },
        ...history.slice(-6).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || "")
        })),
        {
          role: "user",
          content: `用户问题：${message}\n\n本地检索资料：\n${context}`
        }
      ]
    })
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return {
      answer: localFallbackAnswer(message),
      mode: "local",
      warning: `模型接口调用失败：${errorText.slice(0, 300)}`
    };
  }

  const payload = await upstream.json();
  return {
    answer: payload?.choices?.[0]?.message?.content || localFallbackAnswer(message),
    mode: "llm",
    results
  };
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (request.method === "GET" && url.pathname === "/api/search") {
        const query = url.searchParams.get("q") || "";
        const limit = url.searchParams.get("limit") || "12";
        sendJson(response, 200, await searchKnowledgeAsync(query, limit));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/data") {
        sendJson(response, 200, await loadDataAsync());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/community-exchange") {
        sendJson(response, 200, await readCommunityStore());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/community-exchange") {
        const body = await readBody(request);
        if (body.action === "saveEntry") {
          sendJson(response, 200, await saveCommunityEntry(body.entry));
          return;
        }
        if (body.action === "deleteEntry") {
          sendJson(response, 200, await deleteCommunityEntry(body));
          return;
        }
        sendJson(response, 400, { error: "unknown action" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const body = await readBody(request);
        const message = String(body.message || "").trim();
        const sitePassword = process.env.SITE_PASSWORD?.trim();

        if (!message) {
          sendJson(response, 400, { error: "message is required" });
          return;
        }

        if (sitePassword && body.password !== sitePassword) {
          sendJson(response, 401, { error: "password required" });
          return;
        }

        sendJson(response, 200, await callSharedModel(message, Array.isArray(body.history) ? body.history : []));
        return;
      }

      if (request.method === "GET") {
        serveStatic(request, response, url);
        return;
      }

      sendText(response, 405, "Method not allowed");
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: "internal server error" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`洛克王国虚拟助手已启动：http://localhost:${port}`);
  });
}
