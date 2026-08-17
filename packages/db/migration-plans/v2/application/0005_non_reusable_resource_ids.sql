-- Versioned v2 application migration. The immutable migrations/ lane remains
-- a separate historical clean-bootstrap contract and is not rewritten here.

-- This registry is intentionally payload-free. A resource identity is allocated
-- before its live row is inserted and is retained forever after hard deletion.
CREATE TABLE private_data.resource_id_registry (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  resource_type text NOT NULL CHECK (resource_type IN ('thesis', 'alert')),
  resource_id uuid NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'live'
    CHECK (lifecycle_state IN ('live', 'deleted')),
  registered_at timestamptz NOT NULL,
  tombstoned_at timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, resource_type, resource_id),
  UNIQUE (
    organization_id,
    resource_type,
    resource_id,
    lifecycle_state
  ),
  CHECK (
    (lifecycle_state = 'live' AND tombstoned_at IS NULL)
    OR (lifecycle_state = 'deleted' AND tombstoned_at IS NOT NULL)
  ),
  CHECK (tombstoned_at IS NULL OR tombstoned_at >= registered_at)
);

-- Generated constants make the foreign key require the registry's exact live
-- state. A tombstoned identity therefore cannot back a new live resource row.
ALTER TABLE private_data.theses
  ADD COLUMN registered_resource_type text GENERATED ALWAYS AS (
    'thesis'::text
  ) STORED,
  ADD COLUMN registered_lifecycle_state text GENERATED ALWAYS AS (
    'live'::text
  ) STORED,
  ADD CONSTRAINT theses_require_live_registered_id
    FOREIGN KEY (
      organization_id,
      registered_resource_type,
      id,
      registered_lifecycle_state
    )
    REFERENCES private_data.resource_id_registry (
      organization_id,
      resource_type,
      resource_id,
      lifecycle_state
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

ALTER TABLE private_data.alert_rules
  ADD COLUMN registered_resource_type text GENERATED ALWAYS AS (
    'alert'::text
  ) STORED,
  ADD COLUMN registered_lifecycle_state text GENERATED ALWAYS AS (
    'live'::text
  ) STORED,
  ADD CONSTRAINT alert_rules_require_live_registered_id
    FOREIGN KEY (
      organization_id,
      registered_resource_type,
      id,
      registered_lifecycle_state
    )
    REFERENCES private_data.resource_id_registry (
      organization_id,
      resource_type,
      resource_id,
      lifecycle_state
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

CREATE FUNCTION private_data.guard_resource_id_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'resource identity registry rows cannot be deleted';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
    OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
    OR NEW.registered_at IS DISTINCT FROM OLD.registered_at
    OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'resource identity registry metadata is immutable';
  END IF;

  IF OLD.lifecycle_state IS DISTINCT FROM 'live'
    OR NEW.lifecycle_state IS DISTINCT FROM 'deleted'
    OR OLD.tombstoned_at IS NOT NULL
    OR NEW.tombstoned_at IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'resource identity lifecycle only permits live to deleted';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.tombstone_resource_id_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE private_data.resource_id_registry
  SET
    lifecycle_state = 'deleted',
    tombstoned_at = transaction_timestamp()
  WHERE organization_id = OLD.organization_id
    AND resource_type = TG_ARGV[0]
    AND resource_id = OLD.id
    AND lifecycle_state = 'live';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'hard deletion must tombstone exactly one live resource identity';
  END IF;

  RETURN OLD;
END;
$function$;

CREATE FUNCTION private_data.guard_live_resource_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'live resource tenant and identity are immutable';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER resource_id_registry_append_only
  BEFORE UPDATE OR DELETE ON private_data.resource_id_registry
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_resource_id_registry();

CREATE TRIGGER theses_identity_immutable
  BEFORE UPDATE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_live_resource_identity();

CREATE TRIGGER alert_rules_identity_immutable
  BEFORE UPDATE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_live_resource_identity();

CREATE TRIGGER theses_tombstone_after_delete
  AFTER DELETE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION private_data.tombstone_resource_id_after_delete('thesis');

CREATE TRIGGER alert_rules_tombstone_after_delete
  AFTER DELETE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION private_data.tombstone_resource_id_after_delete('alert');


REVOKE ALL ON FUNCTION private_data.guard_resource_id_registry() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.tombstone_resource_id_after_delete()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.guard_live_resource_identity() FROM PUBLIC;

ALTER TABLE private_data.resource_id_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_id_registry FORCE ROW LEVEL SECURITY;

CREATE POLICY resource_id_registry_read_current_organization
  ON private_data.resource_id_registry
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

CREATE POLICY test_seed_resource_id_registry_read
  ON private_data.resource_id_registry
  FOR SELECT TO research_cockpit_test_seed
  USING (data_classification = 'synthetic');

CREATE POLICY test_seed_resource_id_registry_insert
  ON private_data.resource_id_registry
  FOR INSERT TO research_cockpit_test_seed
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY backup_read_resource_id_registry
  ON private_data.resource_id_registry
  FOR SELECT TO research_cockpit_backup
  USING (data_classification = 'synthetic');

GRANT SELECT ON private_data.resource_id_registry
  TO research_cockpit_runtime;
GRANT SELECT, INSERT ON private_data.resource_id_registry
  TO research_cockpit_test_seed;
GRANT SELECT ON private_data.resource_id_registry
  TO research_cockpit_backup;

REVOKE ALL ON TABLE private_data.resource_id_registry FROM PUBLIC;
