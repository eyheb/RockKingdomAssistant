# 部署说明

当前项目是纯 Node.js 服务，不是 Next.js/Vercel 站点。推荐优先用 Render 或 Railway。

## 方案 A：Render

1. 把 `agent/rock_virtual_assistant` 推到 GitHub 仓库。
2. 在 Render 新建 `Web Service`。
3. 选择仓库和目录。
4. 设置：

```text
Build Command: npm install && npm run build
Start Command: npm start
```

环境变量：

```dotenv
LLM_API_KEY=你的 key
LLM_BASE_URL=https://gmn.chuangzuoli.com/v1
LLM_MODEL=gpt-5.4
SITE_PASSWORD=
```

Render 会给一个 `https://xxx.onrender.com` 链接，可以直接发给朋友。

## 方案 B：Railway

1. 新建 Railway Project。
2. 连接 GitHub 仓库。
3. 设置 Root Directory 为 `agent/rock_virtual_assistant`。
4. 添加同样的环境变量。
5. Railway 会自动执行 `npm start`，也可以手动设置 Start Command。

## 方案 C：临时公网链接

适合只想今晚发给朋友试用。

先本地启动：

```powershell
npm start
```

再用 ngrok：

```powershell
ngrok http 3000
```

或 localtunnel：

```powershell
npm run tunnel
```

localtunnel 免费公共服务可能会要求访问者输入你的本机出口 IP 作为验证，这个页面不能由本站代码跳过。

或 Cloudflare Tunnel：

```powershell
cloudflared tunnel --url http://localhost:3000
```

Cloudflare Tunnel 通常不会要求朋友输入你的 IP。它会生成一个 `https://xxx.trycloudflare.com` 临时公网 HTTPS 链接。电脑关机或命令停止后链接会失效。

## Docker

也可以用 Docker 部署：

```bash
docker build -t rock-virtual-assistant .
docker run -p 3000:3000 --env-file .env rock-virtual-assistant
```

## 更新数据

替换 `materials/raw/` 里的 Excel 或 HTML 后运行：

```bash
npm run build:data
```

会重新生成：

```text
data/spirits.json
data/egg-groups.json
data/exchange.json
```
