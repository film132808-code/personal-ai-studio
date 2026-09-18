-- Fix for Custom Providers - Run this in Supabase SQL Editor

-- Drop the check constraint that limits providers to only 3
ALTER TABLE public.provider_connections DROP CONSTRAINT IF EXISTS provider_connections_provider_check;

-- Add columns for custom providers
ALTER TABLE public.provider_connections ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE public.provider_connections ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.provider_connections ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

-- Create index for custom providers
CREATE INDEX IF NOT EXISTS idx_provider_connections_custom ON public.provider_connections(user_id, is_custom);

-- Update existing rows to set is_custom false
UPDATE public.provider_connections SET is_custom = false WHERE is_custom IS NULL;
