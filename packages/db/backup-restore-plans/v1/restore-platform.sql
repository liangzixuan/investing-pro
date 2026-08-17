BEGIN;

DO $restore_platform_preflight$
BEGIN
  IF pg_catalog.current_database() <>
    'research_cockpit_acceptance_restore_test'
  THEN
    RAISE EXCEPTION 'restore platform bootstrap refused for database %',
      pg_catalog.current_database();
  END IF;

  IF session_user <> current_user OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
      AND rolsuper
  ) THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires the authenticated superuser identity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
      AND pg_catalog.pg_get_userbyid(datdba) = 'postgres'
      AND NOT datistemplate
      AND datallowconn
      AND datconnlimit = -1
      AND pg_catalog.pg_encoding_to_char(encoding) = 'UTF8'
  ) THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires the exact disposable database';
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
      FROM pg_catalog.pg_default_acl AS defaults
      JOIN pg_catalog.pg_roles AS role ON role.oid = defaults.defaclrole
      WHERE role.rolname = 'research_cockpit_owner'
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'restore platform bootstrap requires a pristine target';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_roles
    WHERE pg_catalog.left(rolname, 17) = 'research_cockpit_'
  ) <> 4
    OR (
      SELECT count(*)
      FROM pg_catalog.pg_authid
      WHERE rolname IN (
        'research_cockpit_owner',
        'research_cockpit_runtime',
        'research_cockpit_test_seed',
        'research_cockpit_backup'
      )
        AND NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolinherit
        AND NOT rolbypassrls
        AND rolconnlimit = -1
        AND rolpassword IS NULL
        AND rolvaliduntil IS NULL
    ) <> 4
  THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires the exact capability roles';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE pg_catalog.left(granted_role.rolname, 17) = 'research_cockpit_'
       OR pg_catalog.left(member_role.rolname, 17) = 'research_cockpit_'
  ) THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires zero capability-role memberships';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting AS setting
    JOIN pg_catalog.pg_roles AS role ON role.oid = setting.setrole
    WHERE pg_catalog.left(role.rolname, 17) = 'research_cockpit_'
  ) THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires zero capability-role settings';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      pg_catalog.coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) AS privilege
    WHERE namespace.nspname = 'public'
      AND privilege.grantee <> namespace.nspowner
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'USAGE'
      AND NOT privilege.is_grantable
  ) <> 1 OR (
    SELECT count(*)
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      pg_catalog.coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) AS privilege
    WHERE namespace.nspname = 'public'
      AND privilege.grantee <> namespace.nspowner
  ) <> 1 THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires the pristine public schema ACL';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_database AS database
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      pg_catalog.coalesce(
        database.datacl,
        pg_catalog.acldefault('d', database.datdba)
      )
    ) AS privilege
    WHERE database.datname = pg_catalog.current_database()
      AND privilege.grantee <> database.datdba
  ) <> 2 OR (
    SELECT count(*)
    FROM pg_catalog.pg_database AS database
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      pg_catalog.coalesce(
        database.datacl,
        pg_catalog.acldefault('d', database.datdba)
      )
    ) AS privilege
    WHERE database.datname = pg_catalog.current_database()
      AND privilege.grantee = 0
      AND privilege.privilege_type IN ('CONNECT', 'TEMPORARY')
      AND NOT privilege.is_grantable
  ) <> 2 THEN
    RAISE EXCEPTION
      'restore platform bootstrap requires the pristine database ACL';
  END IF;
END;
$restore_platform_preflight$;

CREATE SCHEMA shared_data;
CREATE SCHEMA private_data;

ALTER SCHEMA shared_data OWNER TO research_cockpit_owner;
ALTER SCHEMA private_data OWNER TO research_cockpit_owner;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA shared_data FROM PUBLIC;
REVOKE ALL ON SCHEMA private_data FROM PUBLIC;

CREATE EXTENSION btree_gist WITH SCHEMA shared_data;

-- The restore target must reproduce B7's extension boundary from reviewed
-- source, not from a database-supplied schema archive.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shared_data FROM PUBLIC;

DO $restore_database_privileges$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC',
    pg_catalog.current_database()
  );
END;
$restore_database_privileges$;

COMMIT;
