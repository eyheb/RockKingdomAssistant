# Vercel Deployment

Use this path if Render asks for a payment card.

## Import

1. Open https://vercel.com/new
2. Import `eyheb/LockKingdomAssistant`
3. Keep the root directory as the repository root.
4. Vercel reads `vercel.json` automatically.

## Environment Variables

Add these variables in Project Settings -> Environment Variables:

```dotenv
LLM_API_KEY=your_key
LLM_BASE_URL=https://gmn.chuangzuoli.com/v1
LLM_MODEL=gpt-5.4
SITE_PASSWORD=
```

Leave `SITE_PASSWORD` empty if you do not want a shared password gate.

## Build Settings

These are already configured in `vercel.json`:

```text
Framework Preset: Other
Install Command: npm ci
Build Command: npm run build
Output Directory: public
```

After deployment, Vercel will provide a `https://*.vercel.app` URL.
