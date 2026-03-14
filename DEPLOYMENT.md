# Deployment Guide

This repository deploys cleanly as three services:

1. Backend API on Render
2. Main frontend on Vercel from `frontend/`
3. Buyer portal on Vercel from `buyer-portal/`

## 1. Backend on Render

Render can use the blueprint in `render.yaml`.

- Repository root: `g:\AgroMitra`
- Service root: `.`
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/api/health`

Set these required secrets in Render:

- `MONGODB_URI`
- `JWT_SECRET`
- `SESSION_SECRET`
- `CORS_ORIGIN`

Optional secrets depending on enabled features:

- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `EMAIL_USER`
- `EMAIL_PASS`
- `WEATHER_API_KEY`
- `AGMARKNET_API_KEY`

`CORS_ORIGIN` should contain the production frontend origins as a comma-separated list, for example:

```env
CORS_ORIGIN=https://agromitra.vercel.app,https://agromitra-buyer.vercel.app
```

After deploy, verify:

- `https://your-backend-domain/api/health`

## 2. Main frontend on Vercel

Create a Vercel project with root directory `frontend/`.

- Install command: `npm install`
- Build command: `npm run build`
- Framework preset: `Next.js`

Set:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

This app appends `/api` internally.

## 3. Buyer portal on Vercel

Create a second Vercel project with root directory `buyer-portal/`.

- Install command: `npm install`
- Build command: `npm run build`
- Framework preset: `Next.js`

Set:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
```

This app expects the full `/api` base URL directly.

## 4. Database

Use MongoDB Atlas and set its connection string as:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
```

## 5. Before first production run

- Make sure all required backend secrets are set.
- Seed data only if you want demo/sample content.
- Confirm both Vercel domains are included in backend `CORS_ORIGIN`.
- Test login, marketplace browse, and order flows against production.

## 6. Notes

- The root backend does not serve either Next.js app directly.
- `frontend/` and `buyer-portal/` should stay as separate deployments.
- Do not commit `.env`, `.next`, or `node_modules`.
