BEGIN;

DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'research_cockpit_owner'
  ) THEN
    CREATE ROLE research_cockpit_owner
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT
      NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'research_cockpit_owner'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolinherit
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role: research_cockpit_owner';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'research_cockpit_owner'
       OR member_role.rolname = 'research_cockpit_owner'
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role membership: research_cockpit_owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'research_cockpit_runtime'
  ) THEN
    CREATE ROLE research_cockpit_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT
      NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'research_cockpit_runtime'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolinherit
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role: research_cockpit_runtime';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'research_cockpit_runtime'
       OR member_role.rolname = 'research_cockpit_runtime'
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role membership: research_cockpit_runtime';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'research_cockpit_test_seed'
  ) THEN
    CREATE ROLE research_cockpit_test_seed
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT
      NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'research_cockpit_test_seed'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolinherit
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role: research_cockpit_test_seed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'research_cockpit_test_seed'
       OR member_role.rolname = 'research_cockpit_test_seed'
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role membership: research_cockpit_test_seed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'research_cockpit_backup'
  ) THEN
    CREATE ROLE research_cockpit_backup
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT
      NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'research_cockpit_backup'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolinherit
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role: research_cockpit_backup';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'research_cockpit_backup'
       OR member_role.rolname = 'research_cockpit_backup'
  ) THEN
    RAISE EXCEPTION 'unsafe pre-existing capability role membership: research_cockpit_backup';
  END IF;
END;
$role$;

CREATE SCHEMA shared_data;
CREATE SCHEMA private_data;

ALTER SCHEMA shared_data OWNER TO research_cockpit_owner;
ALTER SCHEMA private_data OWNER TO research_cockpit_owner;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA shared_data FROM PUBLIC;
REVOKE ALL ON SCHEMA private_data FROM PUBLIC;

GRANT USAGE ON SCHEMA shared_data TO research_cockpit_runtime;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_runtime;
GRANT USAGE ON SCHEMA shared_data TO research_cockpit_test_seed;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_test_seed;
GRANT USAGE ON SCHEMA shared_data TO research_cockpit_backup;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_backup;

ALTER DEFAULT PRIVILEGES IN SCHEMA shared_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared_data
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private_data
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA shared_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA private_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA shared_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA private_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA shared_data
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA private_data
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE shared_data.schema_migrations (
  migration_id text PRIMARY KEY,
  file_name text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  applied_by text NOT NULL DEFAULT session_user
);

ALTER TABLE shared_data.schema_migrations OWNER TO research_cockpit_owner;

REVOKE ALL ON TABLE shared_data.schema_migrations FROM PUBLIC;
REVOKE ALL ON TABLE shared_data.schema_migrations FROM research_cockpit_runtime;

CREATE FUNCTION private_data.current_principal_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.principal_id', true), '')::uuid
$function$;

CREATE FUNCTION private_data.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
$function$;

CREATE FUNCTION private_data.current_purpose()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.purpose', true), '')
$function$;

CREATE FUNCTION private_data.current_channel()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.channel', true), '')
$function$;

CREATE FUNCTION private_data.current_territory()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.territory', true), '')
$function$;

CREATE FUNCTION private_data.current_data_classification()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('app.data_classification', true), '')
$function$;

CREATE PROCEDURE private_data.set_request_context(
  principal_id uuid,
  organization_id uuid,
  purpose text,
  channel text,
  territory text,
  data_classification text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $procedure$
BEGIN
  IF principal_id IS NULL OR organization_id IS NULL THEN
    RAISE EXCEPTION 'principal and organization context are required';
  END IF;
  IF purpose NOT IN ('display', 'derive', 'alert', 'export', 'ai') THEN
    RAISE EXCEPTION 'unsupported data purpose';
  END IF;
  IF channel NOT IN ('api', 'web', 'local_alert') THEN
    RAISE EXCEPTION 'unsupported data channel';
  END IF;
  IF territory <> 'demo_only' OR data_classification <> 'synthetic' THEN
    RAISE EXCEPTION 'the static harness accepts synthetic demo context only';
  END IF;

  PERFORM pg_catalog.set_config('app.principal_id', principal_id::text, true);
  PERFORM pg_catalog.set_config('app.organization_id', organization_id::text, true);
  PERFORM pg_catalog.set_config('app.purpose', purpose, true);
  PERFORM pg_catalog.set_config('app.channel', channel, true);
  PERFORM pg_catalog.set_config('app.territory', territory, true);
  PERFORM pg_catalog.set_config(
    'app.data_classification',
    data_classification,
    true
  );
END;
$procedure$;

ALTER FUNCTION private_data.current_principal_id()
  OWNER TO research_cockpit_owner;
ALTER FUNCTION private_data.current_organization_id()
  OWNER TO research_cockpit_owner;
ALTER FUNCTION private_data.current_purpose()
  OWNER TO research_cockpit_owner;
ALTER FUNCTION private_data.current_channel()
  OWNER TO research_cockpit_owner;
ALTER FUNCTION private_data.current_territory()
  OWNER TO research_cockpit_owner;
ALTER FUNCTION private_data.current_data_classification()
  OWNER TO research_cockpit_owner;
ALTER PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) OWNER TO research_cockpit_owner;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private_data FROM PUBLIC;
REVOKE ALL ON ALL PROCEDURES IN SCHEMA private_data FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private_data.current_principal_id()
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.current_organization_id()
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.current_purpose()
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.current_channel()
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.current_territory()
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.current_data_classification()
  TO research_cockpit_runtime;
GRANT EXECUTE ON PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) TO research_cockpit_runtime;

COMMIT;
