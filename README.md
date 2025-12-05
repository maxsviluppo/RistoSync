# RistoSync AI - SaaS Restaurant Management

**RistoSync AI** is a modern, real-time Progressive Web App (PWA) designed to synchronize restaurant workflows between the Dining Room (Waiter App) and the Kitchen (Kitchen Display System). It features a multi-tenant SaaS architecture, meaning multiple restaurants can register and manage their operations independently.

## Features

- **Multi-Role Interface**:
  - **Waiter Pad (9:16)**: Mobile-optimized interface for order taking, table management, and AI assistance.
  - **Kitchen Display (16:9)**: Kanban-style dashboard for chefs with sound notifications and course management.
- **Real-Time Sync**: Powered by Supabase, orders update instantly across all devices.
- **AI Chef Assistant**: Integrated with Google Gemini 2.5 Flash to answer questions about menu items (allergens, pairings, etc.).
- **Smart Menu Manager**: Admin dashboard to manage dishes, prices, categories, and allergens.
- **SaaS Architecture**: Secure login, registration, and data isolation for multiple restaurants.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime)
- **AI**: Google Gemini API (@google/genai)
- **Deployment**: Vercel

## Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- A Supabase Account (Free Tier is sufficient)
- A Google Cloud Account (for Gemini API)

### 2. Database Setup (Supabase)
Create a new Supabase project and run the following SQL query in the **SQL Editor** to set up the tables.

```sql
-- 1. Profiles Table (Tenants)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  restaurant_name text,
  subscription_status text default 'active',
  google_api_key text, -- Stores user's AI Key
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Orders Table
create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id),
  table_number text,
  status text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  items jsonb,
  timestamp bigint,
  waiter_name text
);
alter table public.orders enable row level security;
create policy "Manage own orders" on orders for all using (auth.uid() = user_id);

-- 3. Menu Items Table
create table if not exists public.menu_items (
  id text primary key,
  user_id uuid references auth.users(id),
  name text,
  price numeric,
  category text,
  description text,
  allergens jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.menu_items enable row level security;
create policy "Manage own menu" on menu_items for all using (auth.uid() = user_id);
```

### 3. Super Admin & Permissions Setup (RESET)
If you are facing "Missing Permissions" issues, use this command to reset all policies on the profiles table.
**Run this in Supabase SQL Editor:**

```sql
-- 1. RESET TOTALE (Rimuove TUTTE le policy precedenti)
alter table public.profiles enable row level security;
drop policy if exists "Super Admin View All" on public.profiles;
drop policy if exists "Super Admin Update All" on public.profiles;
drop policy if exists "Super Admin View All Gmail" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- 2. REGOLA VISIBILITÀ TOTALE (Risolve il problema "Non vedo nulla")
create policy "Public profiles are viewable by everyone" 
on public.profiles for select 
using (true);

-- 3. ALTRE REGOLE
create policy "Users can insert their own profile" 
on public.profiles for insert 
with check (auth.uid() = id);

create policy "Users can update own profile" 
on public.profiles for update 
using (auth.uid() = id);

-- 4. POTERI SUPER ADMIN
create policy "Super Admin Update All"
on public.profiles for update
using ( lower(auth.jwt() ->> 'email') = 'castro.massimo@yahoo.com' );
```

### 4. Environment Variables (Vercel)
When deploying to Vercel, set the following environment variables:

- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_KEY`: Your Supabase Anon/Public Key

*Optional:*
- `API_KEY`: A fallback Google Gemini API Key.

## Usage Guide

1. **Register**: Create a new restaurant account.
2. **Configure Menu**: Go to Settings -> Menu Manager to add dishes.
3. **Connect AI**: Go to Settings -> AI Intelligence and paste your Google AI Studio Key.
4. **Start Working**: Open the app on a tablet (Kitchen) and a phone (Waiter). Log in with the same account.

---
Created by MaxSviluppo