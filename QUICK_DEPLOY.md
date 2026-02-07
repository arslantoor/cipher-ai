# Quick Deployment Guide - 5 Minutes

## 🚀 Fastest Way: Vercel (Frontend) + Railway (Backend)

### Frontend on Vercel (2 minutes)

1. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub

2. **Click "Add New Project"**

3. **Import your repository**

4. **Configure**:
   - Root Directory: `frontend`
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Add Environment Variable**:
   - Key: `VITE_API_URL`
   - Value: `https://your-backend.railway.app` (you'll update this after backend deploys)

6. **Click Deploy** ✅

### Backend on Railway (3 minutes)

1. **Go to [railway.app](https://railway.app)** and sign in with GitHub

2. **Click "New Project"** → "Deploy from GitHub repo"

3. **Select your repository**

4. **Configure**:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

5. **Add Environment Variables** (Settings → Variables):
   ```
   GEMINI_API_KEY=your_gemini_key_here
   JWT_SECRET=generate_with_openssl_rand_base64_32
   JWT_REFRESH_SECRET=generate_with_openssl_rand_base64_32
   ENCRYPTION_KEY=generate_with_openssl_rand_hex_16
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.vercel.app
   DATABASE_PATH=./data/cipherai.db
   ```

6. **Deploy** ✅

7. **Get your Railway URL** (e.g., `https://your-app.railway.app`)

8. **Update Frontend**:
   - Go back to Vercel
   - Settings → Environment Variables
   - Update `VITE_API_URL` to your Railway URL
   - Redeploy

### Seed Database (1 minute)

1. **In Railway Dashboard**:
   - Click on your service
   - Open "Connect" or use Railway CLI
   - Run: `npm run seed`

### Done! 🎉

Your app is live:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.railway.app`

---

## Generate Secrets

```bash
# JWT Secret
openssl rand -base64 32

# Encryption Key (32 characters)
openssl rand -hex 16
```

---

## Troubleshooting

**CORS Error?**
- Make sure `FRONTEND_URL` in Railway matches your Vercel URL

**API Not Working?**
- Check `VITE_API_URL` in Vercel matches your Railway URL
- Test backend: `https://your-backend.railway.app/api/health`

**Database Issues?**
- Run `npm run seed` in Railway
- Check Railway logs for errors

---

**Total Time: ~5 minutes | Cost: $0/month** 🚀
