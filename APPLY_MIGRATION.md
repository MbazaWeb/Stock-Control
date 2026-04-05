# How to Apply the Sales Targets Migration

The `sales_targets` table is missing from your Supabase database. Here are two ways to fix it:

## Option 1: Via Supabase Dashboard (Easy - No tech required)

1. Go to https://app.supabase.com
2. Select your project **jaovvaweypydoyfevzct**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file: `supabase/migrations/20260404090000_create_sales_targets.sql`
6. Copy all the SQL code from that file
7. Paste it into the Supabase SQL Editor
8. Click **Run** button
9. Done! The tables are created.

## Option 2: Via Supabase CLI (Requires authentication)

```powershell
# 1. Authenticate with Supabase
supabase login

# 2. Link your project
supabase link --project-ref jaovvaweypydoyfevzct

# 3. Apply pending migrations
supabase db push
```

## Option 3: Get Service Role Key + Script

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings > API > Service role key**
4. Copy the service role key
5. Run in PowerShell:
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "paste-service-role-key-here"
node apply-migration.js
```

---

**Recommendation**: Use Option 1 (Supabase Dashboard) - it's the quickest and doesn't require any local setup.
