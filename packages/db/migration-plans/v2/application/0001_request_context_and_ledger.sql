-- Versioned v2 application migration. The immutable migrations/ lane remains
-- a separate historical clean-bootstrap contract and is not rewritten here.

GRANT USAGE ON SCHEMA shared_data TO research_cockpit_runtime;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_runtime;
GRANT USAGE ON SCHEMA shared_data TO research_cockpit_test_seed;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_test_seed;
GRANT USAGE ON SCHEMA shared_data TO research_cockpit_backup;
GRANT USAGE ON SCHEMA private_data TO research_cockpit_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA shared_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA private_data
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA shared_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner IN SCHEMA private_data
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
-- Function EXECUTE is granted to PUBLIC by PostgreSQL's global default. A
-- per-schema revoke cannot subtract that global privilege, so harden the owner
-- role globally before any application routines are created.
ALTER DEFAULT PRIVILEGES FOR ROLE research_cockpit_owner
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE shared_data.schema_migrations (
  migration_id text PRIMARY KEY,
  file_name text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  applied_by text NOT NULL DEFAULT session_user
);


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

REVOKE ALL ON FUNCTION private_data.current_principal_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.current_purpose() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.current_channel() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.current_territory() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.current_data_classification() FROM PUBLIC;
REVOKE ALL ON PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) FROM PUBLIC;

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
