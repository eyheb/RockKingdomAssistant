# 洛克王国虚拟助手

轻量版在线工具，把现有交换数据库和蛋组资料变成一个可部署、可聊天、可检索的网站。

当前版本使用纯 Node.js + 静态页面，适合先给几个朋友试用。

## 功能

- 从 `materials/raw/洛克王国世界_交换数据库.xlsx` 生成交换数据库。
- 从 `materials/raw/蛋组查询.html` 生成蛋组资料。
- 从 BWIKI 洛克王国世界“精灵图鉴”导入编号、名称、属性、形态、立绘链接等结构化图鉴资料。
- 提供 `GET /api/search`、`GET /api/data`、`POST /api/chat`。
- 未配置模型时使用本地资料摘要；配置模型后会把检索结果作为上下文传给模型。

## 数据来源

图鉴资料来源：`https://wiki.biligame.com/rocom/精灵图鉴`。

BWIKI 页面提示文本数据采用 `CC BY-NC-SA 4.0（署名-非商业性使用-相同方式共享）`，使用时需要标注来源链接。

## 共享交换表

交换记录是共享在线表格，玩家列只是普通字段，不做用户权限限制；任意访问者都可以新增、修改和删除条目。

本地开发默认写入 `data/community-exchange.json`。部署到 Vercel 时，文件系统不会持久保存用户编辑内容；要让朋友在线编辑后长期保存，需要配置 GitHub 写入：

- `COMMUNITY_GITHUB_REPO`：例如 `eyheb/RockKingdomAssistant`
- `COMMUNITY_GITHUB_TOKEN`：带 contents 读写权限的 GitHub token
- `COMMUNITY_GITHUB_BRANCH`：建议使用 `community-data`，避免用户保存数据时改动代码分支
- `COMMUNITY_GITHUB_PATH`：默认 `data/community-exchange.json`

配置后，每次保存或删除都会写回 GitHub 仓库中的 JSON 文件；其他用户下次打开或刷新时会读取最新表格。

## 本地启动

```powershell
npm install
npm run build
npm start
```

默认地址：

```text
http://localhost:3000/?v=20260507-2
```

## 模型配置

复制 `.env.example` 为 `.env`，填入：

```dotenv
LLM_API_KEY=你的 key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## 部署

见 `DEPLOY.md`。推荐先用 Render/Railway 获取一个稳定链接；临时给朋友试用可用 ngrok 或 Cloudflare Tunnel。
