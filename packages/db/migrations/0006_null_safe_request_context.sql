BEGIN;

CREATE OR REPLACE PROCEDURE private_data.set_request_context(
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
  IF purpose IS NULL
    OR purpose NOT IN ('display', 'derive', 'alert', 'export', 'ai')
  THEN
    RAISE EXCEPTION 'unsupported data purpose';
  END IF;
  IF channel IS NULL OR channel NOT IN ('api', 'web', 'local_alert') THEN
    RAISE EXCEPTION 'unsupported data channel';
  END IF;
  IF territory IS DISTINCT FROM 'demo_only'
    OR data_classification IS DISTINCT FROM 'synthetic'
  THEN
    RAISE EXCEPTION 'the static harness accepts synthetic demo context only';
  END IF;

  PERFORM pg_catalog.set_config('app.principal_id', principal_id::text, true);
  PERFORM pg_catalog.set_config(
    'app.organization_id',
    organization_id::text,
    true
  );
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

ALTER PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) OWNER TO research_cockpit_owner;

REVOKE ALL ON PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON PROCEDURE private_data.set_request_context(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) TO research_cockpit_runtime;

COMMIT;
