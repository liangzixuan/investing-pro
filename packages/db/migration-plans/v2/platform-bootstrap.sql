BEGIN;

DO $platform_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'research_cockpit_acceptance_test' THEN
    RAISE EXCEPTION 'platform bootstrap refused for database %',
      pg_catalog.current_database();
  END IF;
  IF session_user <> current_user OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
      AND rolsuper
  ) THEN
    RAISE EXCEPTION 'platform bootstrap requires the authenticated superuser identity';
  END IF;
  IF pg_catalog.to_regnamespace('shared_data') IS NOT NULL
    OR pg_catalog.to_regnamespace('private_data') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_extension
      WHERE extname = 'btree_gist'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'research_cockpit_owner',
        'research_cockpit_runtime',
        'research_cockpit_test_seed',
        'research_cockpit_backup'
      )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'versioned platform bootstrap requires a pristine target';
  END IF;
END;
$platform_preflight$;

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

CREATE EXTENSION btree_gist WITH SCHEMA shared_data;

-- Trusted extension members are owned by the bootstrap superuser on PostgreSQL
-- 17. Keep their default EXECUTE privilege out of PUBLIC before handing the
-- application schemas to the authenticated owner phase.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shared_data FROM PUBLIC;

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
