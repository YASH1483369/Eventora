// Site configuration. Safe to commit: the anon key is public by design
// (security comes from the Row Level Security rules in supabase/schema.sql).
// Leave the two Supabase values empty to run in DEMO MODE (data stays in the browser).
window.EVENTORA_CONFIG = {
  SUPABASE_URL: "",        // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "",   // Project Settings -> API -> anon public key
  SITE_URL: ""             // e.g. "https://eventora.example.com" (used for SEO links)
};
