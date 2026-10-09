-- PostgreSQL Staging Database Creation Script
-- Execute as postgres admin user: psql -U postgres -f setup-staging-db.sql

-- 1. Create Staging User if it doesn't exist
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'trikonekt_staging_user') THEN
      CREATE USER trikonekt_staging_user WITH ENCRYPTED PASSWORD 'staging_secure_password_123!';
   END IF;
END
$$;

-- 2. Create Staging Database
SELECT 'CREATE DATABASE trikonekt_staging OWNER trikonekt_staging_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'trikonekt_staging')\gexec

-- 3. Grant Privileges
GRANT ALL PRIVILEGES ON DATABASE trikonekt_staging TO trikonekt_staging_user;
