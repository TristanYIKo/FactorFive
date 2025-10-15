# 🚀 Quick Deploy Reference

## One-Command Deployment

```bash
# 1. Commit your changes
git add .
git commit -m "Ready for Vercel"
git push

# 2. Install Vercel CLI (one-time)
npm i -g vercel

# 3. Deploy
vercel --prod
```

## Environment Variables (Required)

Add these in Vercel dashboard before deploying:

```env
FINNHUB_KEY=your_actual_finnhub_key
NEWS_API_KEY=your_actual_newsapi_key
```

## Test After Deployment

```bash
# Replace YOUR_APP with your Vercel URL
curl https://YOUR_APP.vercel.app/api/health
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-10-15T...",
  "environment": "production"
}
```

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Run `npm run build` locally first |
| 500 errors | Check environment variables in Vercel |
| 404 on API | Clear Vercel cache and redeploy |
| Slow performance | Check Vercel function logs |

## Files Changed

- ✅ `app/api/health/route.ts` - Added health check
- ✅ `app/api/stock/route.ts` - Added runtime config
- ✅ `app/api/news/route.ts` - Added runtime config
- ✅ `package.json` - Fixed build script
- ✅ `vercel.json` - Added Vercel config
- ✅ `.env.example` - Added template

## What to Git Commit

**Do commit:**
- `.env.example`
- `vercel.json`
- All code changes
- Documentation

**DON'T commit:**
- `.env.local` (has real API keys!)
- `.next/` (build output)
- `node_modules/`

## Support

- Full guide: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- Changes: [VERCEL_DEPLOYMENT_SUMMARY.md](./VERCEL_DEPLOYMENT_SUMMARY.md)
- Vercel docs: https://vercel.com/docs

---

**Status:** ✅ Ready to deploy
**Build:** ✅ Passing
**Runtime:** Node.js
