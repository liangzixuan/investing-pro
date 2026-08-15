BEGIN;

-- Capability roles must not inherit persistent-schema or temporary-object
-- creation through PostgreSQL's database-level PUBLIC defaults.
DO $database_privileges$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC',
    pg_catalog.current_database()
  );
END;
$database_privileges$;

COMMIT;
