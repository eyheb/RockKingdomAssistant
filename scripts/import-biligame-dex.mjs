import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const rawRoot = path.join(projectRoot, "materials", "raw");
const outputDir = path.join(projectRoot, "data");
const sourceUrl = "https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4";
const localHtml = path.join(rawRoot, "biligame-spirit-dex.html");
const outputJson = path.join(outputDir, "biligame-spirit-dex.json");

function compactString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.map(compactString).filter(Boolean))];
}

function decodeHtml(value) {
  return compactString(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, ""));
}

function attr(block, name) {
  const match = block.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function absoluteWikiUrl(href) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, "https://wiki.biligame.com").toString();
}

function cleanImageUrl(url) {
  if (!url) return "";
  const absolute = absoluteWikiUrl(url);
  const match = absolute.match(/^(https?:\/\/patchwiki\.biligame\.com\/images\/rocom)\/thumb\/(.+?\.png)(?:\/\d+px-.+)?$/i);
  return match ? `${match[1]}/${match[2]}` : absolute;
}

async function loadHtml() {
  fs.mkdirSync(rawRoot, { recursive: true });
  if (fs.existsSync(localHtml)) {
    return fs.readFileSync(localHtml, "utf8");
  }

  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download Biligame dex: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  fs.writeFileSync(localHtml, html, "utf8");
  return html;
}

function parseCards(html) {
  const cards = [];
  const start = html.indexOf('<div id="CardSelectTr">');
  const source = start === -1 ? html : html.slice(start);
  const chunks = source.split(/<div class="divsort"/g).slice(1);

  for (const chunk of chunks) {
    const block = `<div class="divsort"${chunk.split(/<div class="divsort"/)[0]}`;
    const number = stripTags(block.match(/block_1[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "").replace(/^NO\./i, "");
    const pageLink = block.match(/<a href="([^"]+)" title="([^"]+)">/i);
    const title = decodeHtml(pageLink?.[2] || "");
    const displayName = stripTags(block.match(/block_2[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || title);
    const variantText = stripTags(block.match(/block_3[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const image =
      block.match(/<img[^>]+src="([^"]+)"[^>]*class="rocom_prop_icon"/i)?.[1]
      || block.match(/class="rocom_prop_icon"[^>]*src="([^"]+)"/i)?.[1]
      || "";

    if (!number || !displayName) continue;

    const name = displayName;
    const wikiTitle = title || name;
    const types = unique(attr(block, "data-param2").split(/[,\s，、]+/));
    const altType = attr(block, "data-param3");
    const specialForms = unique([attr(block, "data-param4"), attr(block, "data-param5")]).filter((item) => item !== "原始形态");
    const hasShiny = attr(block, "data-param6") === "是";

    cards.push({
      number,
      name,
      wikiTitle,
      stage: attr(block, "data-param1"),
      types,
      secondaryType: altType,
      form: variantText || specialForms.join("、") || "原始形态",
      specialForms,
      hasShiny,
      wikiUrl: absoluteWikiUrl(pageLink?.[1] || ""),
      imageUrl: cleanImageUrl(image),
      thumbnailUrl: absoluteWikiUrl(image)
    });
  }

  return cards.sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function main() {
  loadHtml().then((html) => {
    const spirits = parseCards(html);
    const generatedAt = new Date().toISOString();
    const payload = {
      generatedAt,
      source: {
        name: "BWIKI 洛克王国世界 精灵图鉴",
        url: sourceUrl,
        license: "CC BY-NC-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans"
      },
      spirits
    };

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputJson, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Imported ${spirits.length} Biligame dex spirits`);
    console.log(`Source: ${sourceUrl}`);
  });
}

main();
