-- Stop exposing the RLS auto-enable helper on the public API.
--
-- `public.rls_auto_enable()` is an EVENT-TRIGGER function: the database calls it
-- automatically on CREATE TABLE to enable Row Level Security on new public
-- tables. It is not meant to be called directly. Because it lives in the
-- `public` schema, PostgREST exposes it at /rest/v1/rpc/rls_auto_enable, and the
-- `anon` / `authenticated` roles inherit EXECUTE via the default PUBLIC grant.
-- Supabase's linter flags this as a publicly-callable SECURITY DEFINER function
-- (lints 0028 / 0029).
--
-- Revoking EXECUTE from the API roles closes both warnings. It does NOT affect
-- the auto-RLS behaviour: event triggers are fired by the engine as the function
-- owner and never require an EXECUTE grant on the API roles.
--
-- Shared database: this is a one-time change on the shared Supabase instance —
-- running it once is enough; it is safe and idempotent to re-run.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
