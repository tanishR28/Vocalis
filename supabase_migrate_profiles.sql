-- Run in Supabase SQL Editor if profiles table already exists without age/sex.
-- Safe to run multiple times.
-- Fixes: "column profiles.age does not exist" and onboarding loop for returning users.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT CHECK (age IS NULL OR (age >= 18 AND age <= 100));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex INT CHECK (sex IS NULL OR sex IN (0, 1));

-- Optional: link profiles.id to auth.users (only if every profile row matches a real auth user)
-- ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Patient')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
