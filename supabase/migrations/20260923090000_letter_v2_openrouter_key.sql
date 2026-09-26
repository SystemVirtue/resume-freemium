-- AI provider requests move server side: the user's OpenRouter key is stored with
-- their profile and read by the ai-chat edge function, so the browser never holds
-- or sends the credential. Rows stay owner-scoped by the existing profiles policy.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS openrouter_key TEXT;
