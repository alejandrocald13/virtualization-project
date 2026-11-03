SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'readonly_user', :'readonly_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'readonly_user') \gexec

-- Keeps the password in sync with Doppler when the role already exists.
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'readonly_user', :'readonly_password') \gexec

GRANT CONNECT ON DATABASE :"DBNAME" TO :"readonly_user";
GRANT USAGE ON SCHEMA public TO :"readonly_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"readonly_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO :"readonly_user";
