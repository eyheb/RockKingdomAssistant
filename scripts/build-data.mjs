import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const repoRoot = path.resolve(projectRoot, "../..");
const rawRoot = path.join(projectRoot, "materials", "raw");
const sourceExcel = firstExisting([
  path.join(rawRoot, "洛克王国世界_交换数据库.xlsx"),
  path.join(repoRoot, "洛克王国世界_交换数据库.xlsx")
]);
const sourceEggHtml = firstExisting([
  path.join(rawRoot, "蛋组查询.html"),
  path.join(repoRoot, "蛋组查询.html")
]);
const outputDir = path.join(projectRoot, "data");

function firstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function compactString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function unique(values) {
  return [...new Set(values.map(compactString).filter(Boolean))];
}

function readExchangeWorkbook() {
  if (!fs.existsSync(sourceExcel)) {
    throw new Error(`Missing source file: ${sourceExcel}`);
  }
  const workbook = XLSX.readFile(sourceExcel);
  const spiritsSheet = workbook.Sheets["精灵数据库"];
  const entriesSheet = workbook.Sheets["录入"];

  if (!spiritsSheet || !entriesSheet) {
    throw new Error("Excel must contain sheets named 精灵数据库 and 录入");
  }

  const spiritRows = XLSX.utils.sheet_to_json(spiritsSheet, { defval: "" });
  const entryRows = XLSX.utils.sheet_to_json(entriesSheet, { defval: "" });

  const spirits = spiritRows
    .map((row) => ({
      name: compactString(row["精灵名称"]),
      eggGroups: unique([row["蛋组1"], row["蛋组2"]])
    }))
    .filter((item) => item.name);

  const entries = entryRows
    .map((row, index) => ({
      id: compactString(row["id"]) || `记录${index + 1}`,
      spirit: compactString(row["精灵名称"]),
      gender: compactString(row["性别"]),
      eggGroups: unique([row["蛋组1"], row["蛋组2"]]),
      nature: compactString(row["性格"]),
      stats: {
        hp: compactString(row["生命资质"]),
        attack: compactString(row["物攻资质"]),
        magicAttack: compactString(row["魔攻资质"]),
        defense: compactString(row["物防资质"]),
        magicDefense: compactString(row["魔防资质"]),
        speed: compactString(row["速度资质"])
      },
      note: compactString(row["备注"])
    }))
    .filter((item) => item.spirit);

  return { spirits, entries };
}

function readEggGroupsFromHtml() {
  if (!fs.existsSync(sourceEggHtml)) {
    throw new Error(`Missing source file: ${sourceEggHtml}`);
  }
  const html = fs.readFileSync(sourceEggHtml, "utf8");
  const rawMatch = html.match(/const\s+RAW\s*=\s*(\[[\s\S]*?\]);/);
  const colorMatch = html.match(/const\s+GROUP_COLORS\s*=\s*({[\s\S]*?});/);

  if (!rawMatch) {
    throw new Error("Could not find RAW egg group data in 蛋组查询.html");
  }

  const raw = Function(`"use strict"; return (${rawMatch[1]});`)();
  const colors = colorMatch ? Function(`"use strict"; return (${colorMatch[1]});`)() : {};
  const spiritMap = new Map();
  const groupMap = new Map();

  for (const [name, group] of raw) {
    const cleanName = compactString(name);
    const cleanGroup = compactString(group);
    if (!cleanName || !cleanGroup) continue;

    if (!spiritMap.has(cleanName)) spiritMap.set(cleanName, new Set());
    spiritMap.get(cleanName).add(cleanGroup);

    if (!groupMap.has(cleanGroup)) groupMap.set(cleanGroup, new Set());
    groupMap.get(cleanGroup).add(cleanName);
  }

  const spirits = [...spiritMap.entries()]
    .map(([name, groups]) => ({ name, eggGroups: [...groups] }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  const groups = [...groupMap.entries()]
    .map(([name, spiritSet]) => ({
      name,
      color: colors[name] || "#6b7280",
      spirits: [...spiritSet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  return { spirits, groups };
}

function mergeSpiritData(exchangeSpirits, eggSpirits) {
  const merged = new Map();

  for (const item of [...exchangeSpirits, ...eggSpirits]) {
    if (!merged.has(item.name)) {
      merged.set(item.name, { name: item.name, eggGroups: [] });
    }
    const current = merged.get(item.name);
    current.eggGroups = unique([...current.eggGroups, ...item.eggGroups]);
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function main() {
  const exchange = readExchangeWorkbook();
  const eggData = readEggGroupsFromHtml();
  const spirits = mergeSpiritData(exchange.spirits, eggData.spirits);
  const generatedAt = new Date().toISOString();

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "spirits.json"),
    JSON.stringify({ generatedAt, spirits }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDir, "egg-groups.json"),
    JSON.stringify({ generatedAt, groups: eggData.groups }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDir, "exchange.json"),
    JSON.stringify({ generatedAt, entries: exchange.entries }, null, 2),
    "utf8"
  );

  console.log(`Generated ${spirits.length} spirits`);
  console.log(`Generated ${eggData.groups.length} egg groups`);
  console.log(`Generated ${exchange.entries.length} exchange entries`);
}

main();
