# GNH Prasadam & Expense Management App - Setup & Deployment Guide

This guide walks you through setting up **Supabase** (Backend Database & Storage) and **Vercel** (Frontend Hosting) for the GNH Prasadam PWA App.

---

## 1. Supabase Setup (Database & Storage)

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and log in or sign up.
2. Click **New Project**.
3. Choose your Organization, enter:
   - **Name**: `GNH-Prasadam-App`
   - **Database Password**: (choose a strong password and save it)
   - **Region**: Select the region closest to your users (e.g. `South Asia (Mumbai)` or `ap-south-1`).
4. Click **Create new project** and wait 1–2 minutes for initialization.

---

### Step 2: Run Database Schema & Initial Data
1. In the Supabase Dashboard, click **SQL Editor** (icon on the left menu).
2. Click **New query**.
3. Open the file [`supabase_schema_and_seed.sql`](./supabase_schema_and_seed.sql) in your project root.
4. Copy the entire content and paste it into the Supabase SQL Editor.
5. Click **Run** (or press `Ctrl+Enter`).
6. You should see `Success. No rows returned`.
   - This creates all 5 tables: `devotees`, `prasadam_counts`, `expenses`, `monthly_ledgers`, `system_config`.
   - Sets up Row Level Security (RLS) policies.
   - Configures the `receipts` storage bucket with public access for bills.
   - Pre-seeds all 30 Vaishnava devotee groups and the default admin PIN (`192108`).

---

### Step 3: Copy Your Supabase API Keys
1. In the Supabase Dashboard, go to **Project Settings** (gear icon at the bottom left) -> **API**.
2. Copy the following two values:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Project API Anon Key** (under *Project API keys* -> `anon` / `public`, starts with `eyJhbGci...`)

---

### Step 4: Add Keys to Local `.env` (Optional for local testing)
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
*(Note: If `.env` is omitted, the app operates automatically in high-performance reactive browser storage mode).*

---

## 2. Vercel Setup (Frontend Deployment)

### Step 1: Push Code to GitHub
1. Initialize git and push your project to a GitHub repository:
```bash
git init
git add .
git commit -m "Initial GNH PWA App release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/GNHApp.git
git push -u origin main
```

---

### Step 2: Import Project in Vercel
1. Log in to [https://vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository (`GNHApp`) and click **Import**.

---

### Step 3: Configure Build & Environment Variables
1. **Framework Preset**: `Vite` (automatically detected).
2. **Root Directory**: `./`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**: Add your Supabase credentials:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your_anon_key_from_supabase`
6. Click **Deploy**.

---

### Step 4: Verification & PWA Installation
1. Once deployment finishes, open the Vercel URL (e.g. `https://gnh-app.vercel.app`).
2. **Mobile Install (PWA)**:
   - On Android Chrome: Tap the 3 dots menu -> **Install App** or **Add to Home screen**.
   - On iOS Safari: Tap the Share button -> **Add to Home Screen**.
3. **Admin Access**:
   - Access via URL: `https://gnh-app.vercel.app/?tab=admin`
   - Enter 6-digit PIN: `192108` (automatically remembered on your device).

---

## 3. Key Operational Rules

| Feature | Behavior |
| :--- | :--- |
| **Prasadam Rates** | Breakfast: ₹40 • Lunch: ₹80 • Dinner: ₹40 |
| **Cutoff Deadline** | 8:00 PM on the 5th of the next month (app implementation lock). WhatsApp reminders retain deadline as last but one day of the month. |
| **Missing Count Auto-Fill** | Unfilled days auto-populate with the devotee's highest entered counts ($Max(B), Max(L), Max(D)$). |
| **Attachment Limit** | Up to 10 MB per bill photo with client-side auto-compression. |
| **Janmashtami Ledger** | Isolated festival accounting that is never mixed with regular monthly meal charges. |
| **Admin PIN** | `192108` (Can be changed in Admin -> Settings). |
