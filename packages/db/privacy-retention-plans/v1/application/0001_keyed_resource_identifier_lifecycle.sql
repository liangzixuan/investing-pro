-- Privacy-retention plan v1 is an empty-data suffix over the exact v2 plan.
-- It is synthetic-only and is not a populated-database migration.

LOCK TABLE
  ONLY private_data.organizations,
  ONLY private_data.principals,
  ONLY private_data.organization_principals,
  ONLY private_data.memberships,
  ONLY private_data.entitlements,
  ONLY private_data.theses,
  ONLY private_data.alert_rules,
  ONLY private_data.idempotency_records,
  ONLY private_data.audit_events,
  ONLY private_data.resource_id_registry
IN SHARE ROW EXCLUSIVE MODE;

DO $privacy_empty_only_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM private_data.organizations LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.principals LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.organization_principals LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.memberships LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.entitlements LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.theses LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.alert_rules LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.idempotency_records LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.audit_events LIMIT 1)
    OR EXISTS (SELECT 1 FROM private_data.resource_id_registry LIMIT 1)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'privacy-retention v1 requires empty tenant data';
  END IF;
END;
$privacy_empty_only_preflight$;

DROP TRIGGER theses_tombstone_after_delete ON private_data.theses;
DROP TRIGGER alert_rules_tombstone_after_delete ON private_data.alert_rules;
DROP TRIGGER resource_id_registry_append_only
  ON private_data.resource_id_registry;

DROP FUNCTION private_data.tombstone_resource_id_after_delete();
DROP FUNCTION private_data.guard_resource_id_registry();

ALTER TABLE private_data.theses
  DROP CONSTRAINT theses_require_live_registered_id,
  DROP COLUMN registered_resource_type,
  DROP COLUMN registered_lifecycle_state;

ALTER TABLE private_data.alert_rules
  DROP CONSTRAINT alert_rules_require_live_registered_id,
  DROP COLUMN registered_resource_type,
  DROP COLUMN registered_lifecycle_state;

DROP TABLE private_data.resource_id_registry;

CREATE TABLE private_data.resource_privacy_domains (
  privacy_domain_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE
    REFERENCES private_data.organizations(id) ON DELETE RESTRICT,
  key_reference uuid NOT NULL UNIQUE,
  key_version integer NOT NULL CHECK (key_version = 1),
  token_scheme text NOT NULL DEFAULT 'hmac-sha256-v1'
    CHECK (token_scheme = 'hmac-sha256-v1'),
  lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'offboarding')),
  created_at timestamptz NOT NULL,
  offboarding_started_at timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  UNIQUE (privacy_domain_id, organization_id),
  CHECK (
    (lifecycle_state = 'active' AND offboarding_started_at IS NULL)
    OR (
      lifecycle_state = 'offboarding'
      AND offboarding_started_at IS NOT NULL
      AND offboarding_started_at >= created_at
    )
  )
);

CREATE TABLE private_data.resource_id_registry (
  allocation_id uuid PRIMARY KEY,
  privacy_domain_id uuid NOT NULL
    REFERENCES private_data.resource_privacy_domains(privacy_domain_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  organization_id uuid,
  resource_type text NOT NULL CHECK (resource_type IN ('thesis', 'alert')),
  resource_id uuid,
  resource_token bytea NOT NULL CHECK (octet_length(resource_token) = 32),
  lifecycle_state text NOT NULL DEFAULT 'live'
    CHECK (lifecycle_state IN ('live', 'deleted')),
  registered_at timestamptz NOT NULL,
  tombstoned_at timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  UNIQUE (privacy_domain_id, resource_type, resource_token),
  UNIQUE (
    allocation_id,
    organization_id,
    resource_type,
    resource_id,
    lifecycle_state
  ),
  FOREIGN KEY (privacy_domain_id, organization_id)
    REFERENCES private_data.resource_privacy_domains(
      privacy_domain_id,
      organization_id
    ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (
    (
      lifecycle_state = 'live'
      AND organization_id IS NOT NULL
      AND resource_id IS NOT NULL
      AND tombstoned_at IS NULL
    )
    OR (
      lifecycle_state = 'deleted'
      AND organization_id IS NULL
      AND resource_id IS NULL
      AND tombstoned_at IS NOT NULL
    )
  ),
  CHECK (tombstoned_at IS NULL OR tombstoned_at >= registered_at)
);

ALTER TABLE private_data.theses
  ADD COLUMN registered_allocation_id uuid NOT NULL,
  ADD COLUMN registered_resource_type text GENERATED ALWAYS AS (
    'thesis'::text
  ) STORED,
  ADD COLUMN registered_lifecycle_state text GENERATED ALWAYS AS (
    'live'::text
  ) STORED,
  ADD CONSTRAINT theses_require_live_private_token
    FOREIGN KEY (
      registered_allocation_id,
      organization_id,
      registered_resource_type,
      id,
      registered_lifecycle_state
    )
    REFERENCES private_data.resource_id_registry (
      allocation_id,
      organization_id,
      resource_type,
      resource_id,
      lifecycle_state
    )
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE private_data.alert_rules
  ADD COLUMN registered_allocation_id uuid NOT NULL,
  ADD COLUMN registered_resource_type text GENERATED ALWAYS AS (
    'alert'::text
  ) STORED,
  ADD COLUMN registered_lifecycle_state text GENERATED ALWAYS AS (
    'live'::text
  ) STORED,
  ADD CONSTRAINT alert_rules_require_live_private_token
    FOREIGN KEY (
      registered_allocation_id,
      organization_id,
      registered_resource_type,
      id,
      registered_lifecycle_state
    )
    REFERENCES private_data.resource_id_registry (
      allocation_id,
      organization_id,
      resource_type,
      resource_id,
      lifecycle_state
    )
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION private_data.guard_live_resource_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.registered_allocation_id
      IS DISTINCT FROM OLD.registered_allocation_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'live resource tenant, identity, and allocation are immutable';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.guard_resource_privacy_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lifecycle_state IS DISTINCT FROM 'offboarding' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'only an offboarding privacy domain may be purged';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.privacy_domain_id IS DISTINCT FROM OLD.privacy_domain_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.key_reference IS DISTINCT FROM OLD.key_reference
    OR NEW.key_version IS DISTINCT FROM OLD.key_version
    OR NEW.token_scheme IS DISTINCT FROM OLD.token_scheme
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
    OR OLD.lifecycle_state IS DISTINCT FROM 'active'
    OR NEW.lifecycle_state IS DISTINCT FROM 'offboarding'
    OR OLD.offboarding_started_at IS NOT NULL
    OR NEW.offboarding_started_at IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'privacy domain permits only active to offboarding';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.guard_resource_id_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM 1
    FROM private_data.resource_privacy_domains AS domain_row
    WHERE domain_row.privacy_domain_id = NEW.privacy_domain_id
      AND domain_row.organization_id = NEW.organization_id
      AND domain_row.lifecycle_state = 'active'
      AND domain_row.data_classification = 'synthetic'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'resource allocation requires one active privacy domain';
    END IF;

    IF NEW.lifecycle_state IS DISTINCT FROM 'live'
      OR NEW.organization_id IS NULL
      OR NEW.resource_id IS NULL
      OR NEW.tombstoned_at IS NOT NULL
      OR NEW.data_classification IS DISTINCT FROM 'synthetic'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'new resource allocation must be synthetic and live';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.privacy_domain_id = OLD.privacy_domain_id
        AND domain_row.lifecycle_state = 'offboarding'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'resource tokens may be purged only during offboarding';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.allocation_id IS DISTINCT FROM OLD.allocation_id
    OR NEW.privacy_domain_id IS DISTINCT FROM OLD.privacy_domain_id
    OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
    OR NEW.resource_token IS DISTINCT FROM OLD.resource_token
    OR NEW.registered_at IS DISTINCT FROM OLD.registered_at
    OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
    OR OLD.lifecycle_state IS DISTINCT FROM 'live'
    OR NEW.lifecycle_state IS DISTINCT FROM 'deleted'
    OR NEW.organization_id IS NOT NULL
    OR NEW.resource_id IS NOT NULL
    OR OLD.tombstoned_at IS NOT NULL
    OR NEW.tombstoned_at IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'resource identity permits only raw-clearing live to deleted';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.guard_active_privacy_domain_for_live_resource()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  PERFORM 1
  FROM private_data.resource_privacy_domains AS domain_row
  WHERE domain_row.organization_id = NEW.organization_id
    AND domain_row.lifecycle_state = 'active'
    AND domain_row.data_classification = 'synthetic'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'live resource write requires one active privacy domain';
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
    organization_id = NULL,
    resource_id = NULL,
    lifecycle_state = 'deleted',
    tombstoned_at = transaction_timestamp()
  WHERE allocation_id = OLD.registered_allocation_id
    AND organization_id = OLD.organization_id
    AND resource_type = TG_ARGV[0]
    AND resource_id = OLD.id
    AND lifecycle_state = 'live';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'hard deletion must tombstone one keyed resource identity';
  END IF;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER resource_privacy_domains_guard
  BEFORE UPDATE OR DELETE ON private_data.resource_privacy_domains
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_resource_privacy_domain();

CREATE TRIGGER resource_id_registry_guard
  BEFORE INSERT OR UPDATE OR DELETE ON private_data.resource_id_registry
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_resource_id_registry();

CREATE TRIGGER theses_active_privacy_domain_guard
  BEFORE INSERT OR UPDATE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION
    private_data.guard_active_privacy_domain_for_live_resource();

CREATE TRIGGER alert_rules_active_privacy_domain_guard
  BEFORE INSERT OR UPDATE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION
    private_data.guard_active_privacy_domain_for_live_resource();

CREATE TRIGGER theses_tombstone_after_delete
  AFTER DELETE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION private_data.tombstone_resource_id_after_delete('thesis');

CREATE TRIGGER alert_rules_tombstone_after_delete
  AFTER DELETE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION private_data.tombstone_resource_id_after_delete('alert');

CREATE INDEX resource_id_registry_live_lookup
  ON private_data.resource_id_registry (
    organization_id,
    resource_type,
    resource_id
  )
  WHERE lifecycle_state = 'live';

CREATE INDEX audit_events_global_retention
  ON private_data.audit_events (retention_until, organization_id, id);

ALTER TABLE private_data.resource_privacy_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_privacy_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_id_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_id_registry FORCE ROW LEVEL SECURITY;

CREATE POLICY test_seed_resource_privacy_domains
  ON private_data.resource_privacy_domains
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY test_seed_resource_id_registry
  ON private_data.resource_id_registry
  FOR SELECT TO research_cockpit_test_seed
  USING (data_classification = 'synthetic');

CREATE POLICY backup_read_resource_privacy_domains
  ON private_data.resource_privacy_domains
  FOR SELECT TO research_cockpit_backup
  USING (data_classification = 'synthetic');

CREATE POLICY backup_read_resource_id_registry
  ON private_data.resource_id_registry
  FOR SELECT TO research_cockpit_backup
  USING (data_classification = 'synthetic');

CREATE POLICY privacy_owner_resource_privacy_domains
  ON private_data.resource_privacy_domains
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY privacy_owner_resource_id_registry
  ON private_data.resource_id_registry
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY privacy_owner_offboarding_organizations
  ON private_data.organizations
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = organizations.id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = organizations.id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  );

CREATE POLICY privacy_owner_purged_organizations
  ON private_data.organizations
  FOR DELETE TO research_cockpit_owner
  USING (data_classification = 'synthetic');

CREATE POLICY privacy_owner_offboarding_principals
  ON private_data.principals
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND NOT EXISTS (
      SELECT 1
      FROM private_data.organization_principals AS association
      WHERE association.principal_id = principals.id
    )
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_organization_principals
  ON private_data.organization_principals
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = organization_principals.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_memberships
  ON private_data.memberships
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = memberships.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_entitlements
  ON private_data.entitlements
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = entitlements.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_theses
  ON private_data.theses
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = theses.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_alert_rules
  ON private_data.alert_rules
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = alert_rules.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_active_theses_delete
  ON private_data.theses
  FOR DELETE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = theses.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );

CREATE POLICY privacy_owner_active_theses_select
  ON private_data.theses
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = theses.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );

CREATE POLICY privacy_owner_active_alert_rules_delete
  ON private_data.alert_rules
  FOR DELETE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = alert_rules.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );

CREATE POLICY privacy_owner_active_alert_rules_select
  ON private_data.alert_rules
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = alert_rules.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );

CREATE POLICY privacy_owner_offboarding_idempotency_records
  ON private_data.idempotency_records
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = idempotency_records.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_offboarding_audit_events
  ON private_data.audit_events
  FOR ALL TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = audit_events.organization_id
        AND domain_row.lifecycle_state = 'offboarding'
        AND domain_row.data_classification = 'synthetic'
    )
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_expired_idempotency_select
  ON private_data.idempotency_records
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND expires_at <= transaction_timestamp()
  );

CREATE POLICY privacy_owner_expired_audit_select
  ON private_data.audit_events
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND retention_until <= transaction_timestamp()
  );

CREATE POLICY privacy_owner_expired_idempotency_update
  ON private_data.idempotency_records
  FOR UPDATE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND expires_at <= transaction_timestamp()
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_expired_audit_update
  ON private_data.audit_events
  FOR UPDATE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND retention_until <= transaction_timestamp()
  )
  WITH CHECK (false);

CREATE POLICY privacy_owner_expired_idempotency_delete
  ON private_data.idempotency_records
  FOR DELETE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND expires_at <= transaction_timestamp()
  );

CREATE POLICY privacy_owner_expired_audit_delete
  ON private_data.audit_events
  FOR DELETE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND retention_until <= transaction_timestamp()
  );

CREATE FUNCTION private_data.allocate_resource_identifier(
  target_privacy_domain_id uuid,
  target_organization_id uuid,
  target_allocation_id uuid,
  target_resource_type text,
  target_resource_id uuid,
  target_resource_token bytea
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  selected_domain_id uuid;
BEGIN
  SELECT privacy_domain_id
  INTO selected_domain_id
  FROM private_data.resource_privacy_domains
  WHERE privacy_domain_id = target_privacy_domain_id
    AND organization_id = target_organization_id
    AND lifecycle_state = 'active'
    AND data_classification = 'synthetic'
  FOR UPDATE;

  IF selected_domain_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'resource allocation requires one active privacy domain';
  END IF;

  INSERT INTO private_data.resource_id_registry (
    allocation_id,
    privacy_domain_id,
    organization_id,
    resource_type,
    resource_id,
    resource_token,
    registered_at
  )
  VALUES (
    target_allocation_id,
    target_privacy_domain_id,
    target_organization_id,
    target_resource_type,
    target_resource_id,
    target_resource_token,
    transaction_timestamp()
  );

  RETURN target_allocation_id;
END;
$function$;

CREATE FUNCTION private_data.delete_live_resource_by_allocation(
  target_allocation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  selected_privacy_domain_id uuid;
  selected_organization_id uuid;
  selected_resource_type text;
  selected_resource_id uuid;
  affected_rows integer;
BEGIN
  SELECT registry_row.privacy_domain_id
  INTO selected_privacy_domain_id
  FROM private_data.resource_id_registry AS registry_row
  WHERE registry_row.allocation_id = target_allocation_id
    AND registry_row.lifecycle_state = 'live'
    AND registry_row.data_classification = 'synthetic';

  IF selected_privacy_domain_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'live resource deletion requires one live allocation';
  END IF;

  SELECT domain_row.organization_id
  INTO selected_organization_id
  FROM private_data.resource_privacy_domains AS domain_row
  WHERE domain_row.privacy_domain_id = selected_privacy_domain_id
    AND domain_row.lifecycle_state = 'active'
    AND domain_row.data_classification = 'synthetic'
  FOR UPDATE;

  IF selected_organization_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'live resource deletion requires one active privacy domain';
  END IF;

  SELECT registry_row.resource_type, registry_row.resource_id
  INTO selected_resource_type, selected_resource_id
  FROM private_data.resource_id_registry AS registry_row
  WHERE registry_row.allocation_id = target_allocation_id
    AND registry_row.privacy_domain_id = selected_privacy_domain_id
    AND registry_row.organization_id = selected_organization_id
    AND registry_row.lifecycle_state = 'live'
    AND registry_row.data_classification = 'synthetic'
  FOR UPDATE;

  IF selected_resource_type IS NULL OR selected_resource_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'live resource deletion lost its locked allocation';
  END IF;

  IF selected_resource_type = 'thesis' THEN
    DELETE FROM private_data.theses
    WHERE organization_id = selected_organization_id
      AND id = selected_resource_id
      AND registered_allocation_id = target_allocation_id
      AND data_classification = 'synthetic';
  ELSIF selected_resource_type = 'alert' THEN
    DELETE FROM private_data.alert_rules
    WHERE organization_id = selected_organization_id
      AND id = selected_resource_id
      AND registered_allocation_id = target_allocation_id
      AND data_classification = 'synthetic';
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'live resource allocation has an unsupported type';
  END IF;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'live resource deletion must delete exactly one row';
  END IF;

  RETURN target_allocation_id;
END;
$function$;

CREATE FUNCTION private_data.begin_resource_privacy_offboarding(
  target_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  selected_domain_id uuid;
BEGIN
  SELECT privacy_domain_id
  INTO selected_domain_id
  FROM private_data.resource_privacy_domains
  WHERE organization_id = target_organization_id
    AND lifecycle_state = 'active'
    AND data_classification = 'synthetic'
  FOR UPDATE;

  IF selected_domain_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'privacy offboarding requires one active domain';
  END IF;

  UPDATE private_data.resource_privacy_domains
  SET
    lifecycle_state = 'offboarding',
    offboarding_started_at = transaction_timestamp()
  WHERE privacy_domain_id = selected_domain_id
    AND organization_id = target_organization_id
    AND lifecycle_state = 'active'
    AND data_classification = 'synthetic';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'privacy offboarding lost its locked active domain';
  END IF;

  RETURN selected_domain_id;
END;
$function$;

CREATE FUNCTION private_data.purge_tenant_privacy_domain(
  target_privacy_domain_id uuid
)
RETURNS TABLE (
  thesis_rows bigint,
  alert_rule_rows bigint,
  idempotency_rows bigint,
  audit_event_rows bigint,
  entitlement_rows bigint,
  membership_rows bigint,
  organization_principal_rows bigint,
  resource_token_rows bigint,
  orphan_principal_rows bigint,
  privacy_domain_rows bigint,
  organization_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  target_organization_id uuid;
  target_principal_ids uuid[];
BEGIN
  SELECT organization_id
  INTO target_organization_id
  FROM private_data.resource_privacy_domains
  WHERE privacy_domain_id = target_privacy_domain_id
    AND lifecycle_state = 'offboarding'
    AND data_classification = 'synthetic'
  FOR UPDATE;

  IF target_organization_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'tenant purge requires one offboarding privacy domain';
  END IF;

  SELECT COALESCE(
    array_agg(principal_id ORDER BY principal_id),
    ARRAY[]::uuid[]
  )
  INTO target_principal_ids
  FROM private_data.organization_principals
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';

  DELETE FROM private_data.theses
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS thesis_rows = ROW_COUNT;

  DELETE FROM private_data.alert_rules
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS alert_rule_rows = ROW_COUNT;

  DELETE FROM private_data.idempotency_records
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS idempotency_rows = ROW_COUNT;

  DELETE FROM private_data.audit_events
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS audit_event_rows = ROW_COUNT;

  DELETE FROM private_data.entitlements
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS entitlement_rows = ROW_COUNT;

  DELETE FROM private_data.memberships
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS membership_rows = ROW_COUNT;

  DELETE FROM private_data.organization_principals
  WHERE organization_id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS organization_principal_rows = ROW_COUNT;

  DELETE FROM private_data.principals AS principal
  WHERE principal.id = ANY(target_principal_ids)
    AND principal.data_classification = 'synthetic'
    AND NOT EXISTS (
      SELECT 1
      FROM private_data.organization_principals AS association
      WHERE association.principal_id = principal.id
    );
  GET DIAGNOSTICS orphan_principal_rows = ROW_COUNT;

  DELETE FROM private_data.resource_id_registry
  WHERE privacy_domain_id = target_privacy_domain_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS resource_token_rows = ROW_COUNT;

  DELETE FROM private_data.resource_privacy_domains
  WHERE privacy_domain_id = target_privacy_domain_id
    AND organization_id = target_organization_id
    AND lifecycle_state = 'offboarding'
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS privacy_domain_rows = ROW_COUNT;

  IF privacy_domain_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'tenant purge lost its locked privacy domain';
  END IF;

  DELETE FROM private_data.organizations
  WHERE id = target_organization_id
    AND data_classification = 'synthetic';
  GET DIAGNOSTICS organization_rows = ROW_COUNT;

  IF organization_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'tenant purge lost its locked organization';
  END IF;

  RETURN NEXT;
END;
$function$;

CREATE FUNCTION private_data.purge_expired_privacy_metadata()
RETURNS TABLE (
  idempotency_rows bigint,
  audit_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  WITH expired AS (
    SELECT tableoid, ctid
    FROM private_data.idempotency_records
    WHERE expires_at <= transaction_timestamp()
      AND data_classification = 'synthetic'
    ORDER BY expires_at, organization_id, principal_id, operation,
      idempotency_key
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM private_data.idempotency_records AS record
    USING expired
    WHERE record.tableoid = expired.tableoid
      AND record.ctid = expired.ctid
    RETURNING 1
  )
  SELECT count(*) INTO idempotency_rows FROM deleted;

  WITH expired AS (
    SELECT tableoid, ctid
    FROM private_data.audit_events
    WHERE retention_until <= transaction_timestamp()
      AND data_classification = 'synthetic'
    ORDER BY retention_until, organization_id, id
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM private_data.audit_events AS event
    USING expired
    WHERE event.tableoid = expired.tableoid
      AND event.ctid = expired.ctid
    RETURNING 1
  )
  SELECT count(*) INTO audit_rows FROM deleted;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION private_data.guard_live_resource_identity()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.guard_resource_privacy_domain()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.guard_resource_id_registry()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION
  private_data.guard_active_privacy_domain_for_live_resource()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.tombstone_resource_id_after_delete()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.allocate_resource_identifier(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  bytea
)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION
  private_data.delete_live_resource_by_allocation(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.begin_resource_privacy_offboarding(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.purge_tenant_privacy_domain(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.purge_expired_privacy_metadata()
  FROM PUBLIC;

REVOKE ALL ON TABLE private_data.resource_privacy_domains FROM PUBLIC;
REVOKE ALL ON TABLE private_data.resource_id_registry FROM PUBLIC;

GRANT SELECT, INSERT ON private_data.resource_privacy_domains
  TO research_cockpit_test_seed;
GRANT SELECT ON private_data.resource_id_registry
  TO research_cockpit_test_seed;
GRANT SELECT ON private_data.resource_privacy_domains
  TO research_cockpit_backup;
GRANT SELECT ON private_data.resource_id_registry
  TO research_cockpit_backup;

GRANT USAGE ON SCHEMA private_data
  TO research_cockpit_privacy_retention;
GRANT EXECUTE ON FUNCTION private_data.allocate_resource_identifier(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  bytea
)
  TO research_cockpit_privacy_retention;
GRANT EXECUTE ON FUNCTION
  private_data.delete_live_resource_by_allocation(uuid)
  TO research_cockpit_privacy_retention;
GRANT EXECUTE ON FUNCTION private_data.allocate_resource_identifier(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  bytea
)
  TO research_cockpit_test_seed;
GRANT EXECUTE ON FUNCTION
  private_data.begin_resource_privacy_offboarding(uuid)
  TO research_cockpit_privacy_retention;
GRANT EXECUTE ON FUNCTION
  private_data.purge_tenant_privacy_domain(uuid)
  TO research_cockpit_privacy_retention;
GRANT EXECUTE ON FUNCTION
  private_data.purge_expired_privacy_metadata()
  TO research_cockpit_privacy_retention;
