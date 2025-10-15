# 🚀 Deploying to Vercel

**vercel-ready:** This project is configured for zero-config Vercel deployment.

## Quick Deploy (3 Steps)

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Framework auto-detected: **Next.js** ✅

### 3. Add Environment Variables

**Required environment variables:**

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `FINNHUB_KEY` | Stock market data API key | [finnhub.io/register](https://finnhub.io/register) |
| `NEWS_API_KEY` | News articles API key | [newsapi.org/register](https://newsapi.org/register) |

**In Vercel Dashboard:**
- Go to: **Settings** → **Environment Variables**
- Add each variable for **Production**, **Preview**, and **Development**
- Click **"Save"**
- Redeploy if already deployed

---

## Verify Deployment

After deployment completes, test these URLs:

### Health Check
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-10-15T...",
  "environment": "production",
  "vercel": true,
  "env": {
    "hasNewsApiKey": true,
    "hasFinnhubKey": true
  }
}
```

### Application URLs
- **Home Page:** `https://your-app.vercel.app/`
- **Stock Analysis:** `https://your-app.vercel.app/ticker/AAPL`
- **Market Calendar:** `https://your-app.vercel.app/` (Calendar tab)

---

## Local Testing

### Development Mode
```bash
npm install
npm run dev
```
Visit: http://localhost:3000

### Production Build Test
```bash
npm run build
npm start
```
Visit: http://localhost:3000

### Smoke Test
```bash
# Start production build first
npm run build && npm start

# In another terminal:
npm run test:smoke
```

---

## Troubleshooting

### ❌ Build Fails

**Check TypeScript errors:**
```bash
npm run build
```

**Fix missing dependencies:**
```bash
npm install
```

### ❌ Environment Variables Not Working

1. Verify variables in Vercel Dashboard → Settings → Environment Variables
2. Variable names must be UPPERCASE: `FINNHUB_KEY` and `NEWS_API_KEY`
3. No spaces in values
4. Click "Redeploy" after adding/changing variables

### ❌ API Returns 500 Errors

**Check Vercel logs:**
- Dashboard → Deployments → Click deployment → View Function Logs
- Look for error messages in red

**Common causes:**
- Missing environment variables
- API rate limits exceeded (Finnhub: 60/min, NewsAPI: 100/day)
- Timeout (default 10s on Hobby plan)

### ❌ CORS Errors

**Should not happen** - Frontend and API are on same domain.

If you see CORS errors:
- Clear browser cache
- Check that you're using relative paths: `/api/stock` not `http://localhost:3000/api/stock`

---

## Architecture

### API Routes (Serverless Functions)
- **GET /api/health** - Health check and env verification
- **GET /api/stock?symbol=AAPL** - Stock data and analysis
- **GET /api/news?symbol=AAPL** - News articles and sentiment

### Frontend (Static + SSR)
- **/** - Home page (static)
- **/ticker/[symbol]** - Stock details (server-side rendered)

### Environment Setup
- Local dev: Uses `.env.local`
- Vercel: Uses dashboard environment variables
- Base URL: Auto-detected via `lib/baseUrl.ts`

---

## Performance

### Current Limits
- **Finnhub Free:** 60 API calls/minute
- **NewsAPI Free:** 100 requests/day
- **Vercel Hobby:** 100GB bandwidth/month, 10s function timeout

### Caching Strategy
- NewsAPI responses: 15-minute in-memory cache
- Stock data: No caching (real-time data)
- Static pages: Cached by Vercel CDN

---

## Monitoring

### Check Deployment Status
```bash
# Using Vercel CLI
npm install -g vercel
vercel --prod
```

### View Logs
- **Vercel Dashboard** → Deployments → View Function Logs
- Filter by function: `/api/stock`, `/api/news`, etc.

### Monitor Uptime
- Use `/api/health` endpoint with monitoring service
- Expected response time: <1 second

---

## Security Checklist

- [x] API keys in environment variables (not in code)
- [x] `.env.local` in `.gitignore`
- [x] No sensitive data in git history
- [x] API routes run server-side only
- [x] No CORS needed (same origin)
- [x] HTTPS enforced by Vercel

---

## Deployment Checklist

Before deploying:

- [ ] `npm run build` succeeds locally
- [ ] `npm run test:smoke` passes (with server running)
- [ ] Environment variables prepared
- [ ] `.env.local` not committed to git
- [ ] API keys are valid and active

After deploying:

- [ ] `/api/health` returns `ok: true`
- [ ] Environment variables show `true` in health check
- [ ] Home page loads
- [ ] Can search for stock symbol
- [ ] Stock detail page shows data
- [ ] No console errors in browser DevTools

---

## Support

- **Next.js Docs:** https://nextjs.org/docs
- **Vercel Docs:** https://vercel.com/docs
- **Deployment Issues:** Check `VERCEL_DEPLOYMENT_SUMMARY.md`
- **API Issues:** Check individual route documentation

---

## Advanced Configuration

### Custom Domain
1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Increase Timeout (Pro Plan)
Edit `vercel.json`:
```json
{
  "functions": {
    "api/**": {
      "maxDuration": 30
    }
  }
}
```

### Add Redis Caching (KV)
1. Enable Vercel KV in dashboard
2. Update cache implementation in `lib/cache.ts`

---

**Last Updated:** October 15, 2025  
**Vercel Status:** ✅ Ready  
**Build Status:** ✅ Passing
