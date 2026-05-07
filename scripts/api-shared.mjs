import { formatResultsForPrompt, localFallbackAnswer, loadData, searchKnowledge } from "./data-store.mjs";

export function jsonResponse(payload, statusCode = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function textResponse(text, statusCode = 200, headers = {}) {
  return new Response(text, {
    status: statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers
    }
  });
}

export async function readJsonBody(request) {
  if (request && typeof request.json === "function") {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function callModel(message, history = []) {
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
            "你是一个洛克王国世界朋友群使用的虚拟助手。优先根据提供的本地资料回答；资料不足时明确说明不确定，并建议用户补充数据。回答用简洁中文。"
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

export { loadData, searchKnowledge };
