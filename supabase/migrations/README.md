# Supabase Migrations

Migrations are plain SQL files applied manually via the Supabase SQL Editor. There is no migration runner — open the file, paste the contents, and run it.

## How to apply a migration

1. Go to [https://wlewrirolaleibutqbwj.supabase.co](https://wlewrirolaleibutqbwj.supabase.co)
2. Navigate to **SQL Editor** in the left sidebar
3. Paste the contents of the migration file
4. Click **Run**

## Migrations

| File | Description |
|------|-------------|
| `001_api_keys.sql` | Creates the `api_keys` table used for MCP API key authentication |

Apply migrations in order (001, 002, …). Each file is safe to inspect before running — they are plain `CREATE TABLE` / `ALTER TABLE` statements with no destructive operations unless noted.
