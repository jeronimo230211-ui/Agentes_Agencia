-- Ejecutar en Supabase SQL Editor
-- Agrega soporte multi-proveedor a la tabla gyms

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT '360dialog'
    CHECK (provider IN ('meta', '360dialog', 'twilio')),
  ADD COLUMN IF NOT EXISTS provider_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrar api_token existente a provider_config
UPDATE gyms
SET provider_config = jsonb_build_object('api_token', api_token)
WHERE api_token IS NOT NULL AND provider = '360dialog';
