# Deployment Guide - CipherScan AI

## Overview

**Recommended Approach:**
- ✅ **Frontend**: Deploy on Vercel (perfect fit)
- ✅ **Backend**: Deploy on Railway/Render/Fly.io (better for Express + SQLite)

**Alternative:**
- ⚠️ **Both on Vercel**: Possible but requires backend refactoring to serverless functions

---

## Option 1: Frontend on Vercel + Backend on Railway (Recommended)

### Why This Approach?

- **Frontend**: Vercel is optimized for React/Vite apps
- **Backend**: Railway/Render support persistent file storage (SQLite needs this)
- **Cost**: Both have free tiers
- **Setup Time**: ~15 minutes

### Step 1: Deploy Frontend on Vercel

1. **Install Vercel CLI** (optional, or use web UI):
   ```bash
   npm i -g vercel
   ```

2. **Deploy from frontend directory**:
   ```bash
   cd frontend
   vercel
   ```

3. **Or use Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repo
   - Set root directory to `frontend`
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

4. **Set Environment Variable**:
   - In Vercel dashboard → Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://your-backend-url.railway.app` (or your backend URL)

### Step 2: Deploy Backend on Railway

1. **Sign up**: [railway.app](https://railway.app)

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Set root directory to `backend`

3. **Configure Build**:
   - Railway auto-detects Node.js
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

4. **Set Environment Variables**:
   ```
   GEMINI_API_KEY=your_key
   JWT_SECRET=your_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   ENCRYPTION_KEY=your_32_char_key
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.vercel.app
   DATABASE_PATH=./data/cipherai.db
   ```

5. **Deploy**:
   - Railway will build and deploy automatically
   - Get your backend URL (e.g., `https://your-app.railway.app`)

6. **Update Frontend**:
   - Go back to Vercel dashboard
   - Update `VITE_API_URL` to your Railway backend URL
   - Redeploy frontend

### Step 3: Seed Database (One-time)

1. **Connect to Railway**:
   - Railway dashboard → Your service → Connect
   - Or use Railway CLI

2. **Run seed command**:
   ```bash
   npm run seed
   ```

---

## Option 2: Both on Vercel (Advanced)

⚠️ **Warning**: This requires significant backend refactoring. SQLite doesn't work well in serverless.

### Challenges:
- SQLite files don't persist in serverless functions
- `better-sqlite3` requires native bindings
- Need to convert Express routes to serverless functions
- Database needs to be external (PostgreSQL, etc.)

### If You Still Want to Try:

1. **Convert Backend to Serverless Functions**:
   - Move each route to `api/` directory
   - Convert Express middleware to serverless format
   - Use Vercel's serverless function format

2. **Replace SQLite with External Database**:
   - Use Vercel Postgres (free tier available)
   - Or use PlanetScale, Supabase, etc.

3. **Update Database Connection**:
   - Replace `better-sqlite3` with `pg` or your chosen database client

**This is a major refactor and not recommended for quick deployment.**

---

## Option 3: Frontend on Vercel + Backend on Render

### Deploy Backend on Render

1. **Sign up**: [render.com](https://render.com)

2. **Create Web Service**:
   - New → Web Service
   - Connect GitHub repo
   - Root directory: `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

3. **Environment Variables**: Same as Railway

4. **Free Tier**: 750 hours/month (enough for hackathon)

---

## Option 4: Frontend on Vercel + Backend on Fly.io

### Deploy Backend on Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Initialize**:
   ```bash
   cd backend
   fly launch
   ```

4. **Configure**:
   - Follow prompts
   - Set environment variables
   - Deploy: `fly deploy`

---

## Quick Deployment Checklist

### Frontend (Vercel)
- [ ] Push code to GitHub
- [ ] Import to Vercel
- [ ] Set root directory: `frontend`
- [ ] Set `VITE_API_URL` environment variable
- [ ] Deploy

### Backend (Railway/Render)
- [ ] Push code to GitHub
- [ ] Create new project
- [ ] Set root directory: `backend`
- [ ] Add all environment variables
- [ ] Deploy
- [ ] Run database seed
- [ ] Get backend URL

### Final Steps
- [ ] Update frontend `VITE_API_URL` with backend URL
- [ ] Test login
- [ ] Test API endpoints
- [ ] Verify CORS settings

---

## Environment Variables Reference

### Frontend (.env)
```env
VITE_API_URL=https://your-backend-url.railway.app
```

### Backend (.env)
```env
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=generate_strong_random_string
JWT_REFRESH_SECRET=generate_strong_random_string
ENCRYPTION_KEY=32_character_random_string
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
DATABASE_PATH=./data/cipherai.db
```

**Generate Secrets**:
```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (exactly 32 characters)
openssl rand -hex 16
```

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your Vercel frontend URL
- Check CORS configuration in `backend/src/server.ts`

### Database Issues
- Railway/Render provide persistent storage
- SQLite files persist between deployments
- Run `npm run seed` after first deployment

### Build Failures
- Check Node.js version (18+)
- Verify all dependencies in package.json
- Check build logs in deployment platform

### API Connection
- Verify `VITE_API_URL` is set correctly
- Check backend is running and accessible
- Test backend health endpoint: `https://your-backend.railway.app/api/health`

---

## Recommended: Railway + Vercel

**Why Railway for Backend:**
- ✅ Free tier (500 hours/month)
- ✅ Persistent file storage (SQLite works)
- ✅ Auto-deploy from GitHub
- ✅ Easy environment variable management
- ✅ Built-in logs
- ✅ Custom domains

**Why Vercel for Frontend:**
- ✅ Optimized for React/Vite
- ✅ Free tier (unlimited)
- ✅ Global CDN
- ✅ Automatic HTTPS
- ✅ Zero configuration

**Total Cost: $0/month** (for hackathon/demo)

---

## Production Considerations

1. **Database**: Consider migrating to PostgreSQL for production
2. **Monitoring**: Add error tracking (Sentry, etc.)
3. **Backups**: Set up database backups
4. **Scaling**: Configure auto-scaling if needed
5. **Security**: Review rate limits and security headers
6. **Domain**: Add custom domains
7. **SSL**: Verify HTTPS is enabled

---

## Support

If you encounter issues:
1. Check deployment platform logs
2. Verify environment variables
3. Test locally first
4. Check CORS configuration
5. Verify database initialization

Good luck with your deployment! 🚀
