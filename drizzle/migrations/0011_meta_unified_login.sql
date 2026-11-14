-- Meta Unified Login configuration. Keep the singleton row present so Settings can update it.
CREATE TABLE "app_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "meta_app_id" text NOT NULL DEFAULT '',
  "meta_config_id" text NOT NULL DEFAULT ''
);--> statement-breakpoint

-- Legacy Instagram Login App IDs are not Meta App IDs; require the Meta App ID to be entered.
INSERT INTO "app_settings" ("id", "meta_app_id", "meta_config_id")
VALUES (1, '', '')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- This app uses a server-side Postgres connection; no browser/PostgREST policies are required.
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
