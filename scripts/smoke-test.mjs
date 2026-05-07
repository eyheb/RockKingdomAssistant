import { createServer } from "./server.mjs";

const server = createServer();

function listen() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const baseUrl = await listen();

try {
  const searchResponse = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent("魔力猫")}`);
  const search = await searchResponse.json();
  if (!search.spirits.some((item) => item.name === "魔力猫")) {
    throw new Error("Search smoke test failed: 魔力猫 not found");
  }

  const dataResponse = await fetch(`${baseUrl}/api/data`);
  const data = await dataResponse.json();
  if (!data.spirits.some((item) => item.name === "魔力猫")) {
    throw new Error("Data smoke test failed: 魔力猫 not found");
  }

  const chatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "魔力猫在哪个蛋组？" })
  });
  const chat = await chatResponse.json();
  if (!String(chat.answer || "").includes("魔力猫")) {
    throw new Error("Chat smoke test failed: local answer did not mention 魔力猫");
  }

  const pageResponse = await fetch(`${baseUrl}/`);
  const page = await pageResponse.text();
  if (!page.includes("洛克王国虚拟助手")) {
    throw new Error("Page smoke test failed: title not found");
  }
  if (!page.includes("Rock Assistant") || !page.includes("surface-card") || !page.includes("data-view=\"groups\"")) {
    throw new Error("Page smoke test failed: workspace shell markers not found");
  }

  console.log("Smoke test passed");
} finally {
  await close();
}
