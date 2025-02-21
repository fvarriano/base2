-- First create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to postgres and anon roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Create storage schema
CREATE SCHEMA IF NOT EXISTS storage;

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;

-- Create storage.buckets table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Create storage.objects table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_id text NOT NULL REFERENCES storage.buckets(id),
    name text NOT NULL,
    owner uuid,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    last_accessed_at timestamptz DEFAULT NOW(),
    metadata jsonb DEFAULT '{}'::jsonb,
    path_tokens text[] DEFAULT string_to_array(name, '/'),
    UNIQUE (bucket_id, name)
); 