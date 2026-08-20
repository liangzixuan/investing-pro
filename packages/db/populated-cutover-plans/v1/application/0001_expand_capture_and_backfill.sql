-- Populated-cutover plan v1 expands an exact synthetic pre-0005 v2 branch.
-- External token derivation is performed by the authenticated caller after
-- this transaction commits; PostgreSQL never receives a token key.

LOCK TABLE
  ONLY private_data.theses,
  ONLY private_data.alert_rules
IN ACCESS EXCLUSIVE MODE;

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

CREATE TABLE private_data.resource_identifier_cutover_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  capture_epoch bigint NOT NULL DEFAULT 0 CHECK (capture_epoch >= 0),
  lifecycle_state text NOT NULL DEFAULT 'capturing'
    CHECK (lifecycle_state = 'capturing'),
  expanded_at timestamptz NOT NULL,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic')
);

INSERT INTO private_data.resource_identifier_cutover_control (
  singleton,
  expanded_at
) VALUES (true, transaction_timestamp());

-- This is the audited intermediate raw registry. It exists only between the
-- capture boundary and contract commit, and records every live/delete change
-- observed during that interval.
CREATE TABLE private_data.resource_identifier_cutover_work (
  organization_id uuid NOT NULL
    REFERENCES private_data.organizations(id) ON DELETE RESTRICT,
  resource_type text NOT NULL CHECK (resource_type IN ('thesis', 'alert')),
  resource_id uuid NOT NULL,
  desired_state text NOT NULL DEFAULT 'live'
    CHECK (desired_state IN ('live', 'deleted')),
  work_version bigint NOT NULL DEFAULT 1 CHECK (work_version > 0),
  captured_at timestamptz NOT NULL,
  deleted_at timestamptz,
  allocation_id uuid UNIQUE,
  backfilled_at timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, resource_type, resource_id),
  CHECK (
    (desired_state = 'live' AND deleted_at IS NULL)
    OR (
      desired_state = 'deleted'
      AND deleted_at IS NOT NULL
      AND deleted_at >= captured_at
    )
  ),
  CHECK (
    (allocation_id IS NULL AND backfilled_at IS NULL)
    OR (allocation_id IS NOT NULL AND backfilled_at IS NOT NULL)
  )
);

ALTER TABLE private_data.theses
  ADD COLUMN registered_allocation_id uuid,
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
    ON UPDATE RESTRICT ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE private_data.alert_rules
  ADD COLUMN registered_allocation_id uuid,
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
    ON UPDATE RESTRICT ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE private_data.resource_privacy_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_privacy_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_id_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_id_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_identifier_cutover_control
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_identifier_cutover_control
  FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_identifier_cutover_work
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.resource_identifier_cutover_work
  FORCE ROW LEVEL SECURITY;

CREATE POLICY populated_cutover_owner_organizations
  ON private_data.organizations
  FOR SELECT TO research_cockpit_owner
  USING (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_theses
  ON private_data.theses
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_alert_rules
  ON private_data.alert_rules
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_privacy_domains
  ON private_data.resource_privacy_domains
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_registry
  ON private_data.resource_id_registry
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_control
  ON private_data.resource_identifier_cutover_control
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY populated_cutover_owner_work
  ON private_data.resource_identifier_cutover_work
  FOR ALL TO research_cockpit_owner
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE FUNCTION private_data.guard_resource_id_registry_cutover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'resource identities cannot be removed during cutover';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.data_classification IS DISTINCT FROM 'synthetic'
      OR NOT EXISTS (
        SELECT 1
        FROM private_data.resource_privacy_domains AS domain_row
        WHERE domain_row.privacy_domain_id = NEW.privacy_domain_id
          AND domain_row.lifecycle_state = 'active'
          AND domain_row.data_classification = 'synthetic'
          AND (
            NEW.organization_id IS NULL
            OR domain_row.organization_id = NEW.organization_id
          )
      )
      OR (
        NEW.lifecycle_state = 'live'
        AND (
          NEW.organization_id IS NULL
          OR NEW.resource_id IS NULL
          OR NEW.tombstoned_at IS NOT NULL
        )
      )
      OR (
        NEW.lifecycle_state = 'deleted'
        AND (
          NEW.organization_id IS NOT NULL
          OR NEW.resource_id IS NOT NULL
          OR NEW.tombstoned_at IS NULL
        )
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'cutover resource allocation shape is invalid';
    END IF;
    RETURN NEW;
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
      MESSAGE = 'cutover resource identity permits only raw-clearing deletion';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.guard_live_resource_identity_cutover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.id IS DISTINCT FROM OLD.id
    OR (
      OLD.registered_allocation_id IS NOT NULL
      AND NEW.registered_allocation_id
        IS DISTINCT FROM OLD.registered_allocation_id
    )
    OR (
      OLD.registered_allocation_id IS NULL
      AND NEW.registered_allocation_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM private_data.resource_identifier_cutover_work AS work_row
        WHERE work_row.organization_id = NEW.organization_id
          AND work_row.resource_type = TG_ARGV[0]
          AND work_row.resource_id = NEW.id
          AND work_row.desired_state = 'live'
          AND work_row.allocation_id = NEW.registered_allocation_id
          AND work_row.backfilled_at IS NOT NULL
      )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'cutover live resource identity is immutable';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION private_data.capture_resource_identifier_cutover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  selected_allocation_id uuid;
  affected_rows integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.registered_allocation_id IS NOT NULL THEN
      SELECT registry_row.allocation_id
      INTO selected_allocation_id
      FROM private_data.resource_id_registry AS registry_row
      WHERE registry_row.allocation_id = NEW.registered_allocation_id
        AND registry_row.organization_id = NEW.organization_id
        AND registry_row.resource_type = TG_ARGV[0]
        AND registry_row.resource_id = NEW.id
        AND registry_row.lifecycle_state = 'live'
        AND registry_row.data_classification = 'synthetic';

      IF selected_allocation_id IS NULL THEN
        RAISE EXCEPTION USING
          ERRCODE = 'integrity_constraint_violation',
          MESSAGE = 'cutover keyed insert requires one live allocation';
      END IF;
    END IF;

    INSERT INTO private_data.resource_identifier_cutover_work (
      organization_id,
      resource_type,
      resource_id,
      captured_at,
      allocation_id,
      backfilled_at
    ) VALUES (
      NEW.organization_id,
      TG_ARGV[0],
      NEW.id,
      transaction_timestamp(),
      NEW.registered_allocation_id,
      CASE
        WHEN NEW.registered_allocation_id IS NULL THEN NULL
        ELSE transaction_timestamp()
      END
    )
    ON CONFLICT (organization_id, resource_type, resource_id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1
      FROM private_data.resource_identifier_cutover_work AS work_row
      WHERE work_row.organization_id = NEW.organization_id
        AND work_row.resource_type = TG_ARGV[0]
        AND work_row.resource_id = NEW.id
        AND work_row.desired_state = 'live'
        AND work_row.allocation_id IS NOT DISTINCT FROM
          NEW.registered_allocation_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'unique_violation',
        MESSAGE = 'captured resource identity cannot be reused';
    END IF;
  ELSE
    UPDATE private_data.resource_identifier_cutover_work
    SET
      desired_state = 'deleted',
      work_version = work_version + 1,
      deleted_at = transaction_timestamp()
    WHERE organization_id = OLD.organization_id
      AND resource_type = TG_ARGV[0]
      AND resource_id = OLD.id
      AND desired_state = 'live';

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'captured deletion requires one live raw identity';
    END IF;

    IF OLD.registered_allocation_id IS NOT NULL THEN
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
          MESSAGE = 'captured deletion lost its keyed allocation';
      END IF;
    END IF;
  END IF;

  UPDATE private_data.resource_identifier_cutover_control
  SET capture_epoch = capture_epoch + 1
  WHERE singleton
    AND lifecycle_state = 'capturing'
    AND data_classification = 'synthetic';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'resource identifier capture is not active';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER resource_id_registry_cutover_guard
  BEFORE INSERT OR UPDATE OR DELETE ON private_data.resource_id_registry
  FOR EACH ROW
  EXECUTE FUNCTION private_data.guard_resource_id_registry_cutover();

CREATE TRIGGER theses_cutover_identity_immutable
  BEFORE UPDATE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION
    private_data.guard_live_resource_identity_cutover('thesis');

CREATE TRIGGER alert_rules_cutover_identity_immutable
  BEFORE UPDATE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION
    private_data.guard_live_resource_identity_cutover('alert');

CREATE TRIGGER theses_cutover_capture
  AFTER INSERT OR DELETE ON private_data.theses
  FOR EACH ROW
  EXECUTE FUNCTION private_data.capture_resource_identifier_cutover('thesis');

CREATE TRIGGER alert_rules_cutover_capture
  AFTER INSERT OR DELETE ON private_data.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION private_data.capture_resource_identifier_cutover('alert');

INSERT INTO private_data.resource_identifier_cutover_work (
  organization_id,
  resource_type,
  resource_id,
  captured_at
)
SELECT organization_id, 'thesis', id, transaction_timestamp()
FROM private_data.theses
WHERE data_classification = 'synthetic'
UNION ALL
SELECT organization_id, 'alert', id, transaction_timestamp()
FROM private_data.alert_rules
WHERE data_classification = 'synthetic';

UPDATE private_data.resource_identifier_cutover_control
SET capture_epoch = (
  SELECT count(*)
  FROM private_data.resource_identifier_cutover_work
)
WHERE singleton;

CREATE FUNCTION private_data.create_resource_privacy_domain_for_cutover(
  target_privacy_domain_id uuid,
  target_organization_id uuid,
  target_key_reference uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(
    818476709640328254::bigint
  );

  IF NOT EXISTS (
    SELECT 1
    FROM private_data.organizations AS organization_row
    WHERE organization_row.id = target_organization_id
      AND organization_row.data_classification = 'synthetic'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cutover privacy domain requires one synthetic organization';
  END IF;

  INSERT INTO private_data.resource_privacy_domains (
    privacy_domain_id,
    organization_id,
    key_reference,
    key_version,
    token_scheme,
    created_at
  ) VALUES (
    target_privacy_domain_id,
    target_organization_id,
    target_key_reference,
    1,
    'hmac-sha256-v1',
    transaction_timestamp()
  );

  RETURN target_privacy_domain_id;
END;
$function$;

CREATE FUNCTION private_data.claim_resource_identifier_cutover_batch()
RETURNS TABLE (
  organization_id uuid,
  resource_type text,
  resource_id uuid,
  work_version bigint,
  desired_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(
    818476709640328254::bigint
  );

  RETURN QUERY SELECT
    work_row.organization_id,
    work_row.resource_type,
    work_row.resource_id,
    work_row.work_version,
    work_row.desired_state
  FROM private_data.resource_identifier_cutover_work AS work_row
  WHERE work_row.allocation_id IS NULL
    AND work_row.data_classification = 'synthetic'
  ORDER BY
    work_row.organization_id,
    work_row.resource_type,
    work_row.resource_id
  LIMIT 32
  FOR UPDATE SKIP LOCKED;
END;
$function$;

CREATE FUNCTION private_data.backfill_resource_identifier_cutover(
  target_privacy_domain_id uuid,
  target_organization_id uuid,
  target_resource_type text,
  target_resource_id uuid,
  expected_work_version bigint,
  target_allocation_id uuid,
  target_resource_token bytea
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
DECLARE
  selected_state text;
  selected_captured_at timestamptz;
  selected_deleted_at timestamptz;
  affected_rows integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(
    818476709640328254::bigint
  );

  SELECT work_row.desired_state
  INTO selected_state
  FROM private_data.resource_identifier_cutover_work AS work_row
  WHERE work_row.organization_id = target_organization_id
    AND work_row.resource_type = target_resource_type
    AND work_row.resource_id = target_resource_id
    AND work_row.work_version = expected_work_version
    AND work_row.allocation_id IS NULL
    AND work_row.data_classification = 'synthetic';

  IF selected_state IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cutover work changed after external token derivation';
  END IF;

  PERFORM 1
  FROM private_data.resource_privacy_domains AS domain_row
  WHERE domain_row.privacy_domain_id = target_privacy_domain_id
    AND domain_row.organization_id = target_organization_id
    AND domain_row.lifecycle_state = 'active'
    AND domain_row.data_classification = 'synthetic'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cutover backfill requires one active privacy domain';
  END IF;

  IF selected_state = 'live' THEN
    IF target_resource_type = 'thesis' THEN
      PERFORM 1
      FROM private_data.theses AS thesis_row
      WHERE thesis_row.organization_id = target_organization_id
        AND thesis_row.id = target_resource_id
        AND thesis_row.registered_allocation_id IS NULL
        AND thesis_row.data_classification = 'synthetic'
      FOR UPDATE;
    ELSIF target_resource_type = 'alert' THEN
      PERFORM 1
      FROM private_data.alert_rules AS alert_row
      WHERE alert_row.organization_id = target_organization_id
        AND alert_row.id = target_resource_id
        AND alert_row.registered_allocation_id IS NULL
        AND alert_row.data_classification = 'synthetic'
      FOR UPDATE;
    ELSE
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'cutover work has an unsupported resource type';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'cutover live resource changed before work locking';
    END IF;
  END IF;

  SELECT
    work_row.desired_state,
    work_row.captured_at,
    work_row.deleted_at
  INTO selected_state, selected_captured_at, selected_deleted_at
  FROM private_data.resource_identifier_cutover_work AS work_row
  WHERE work_row.organization_id = target_organization_id
    AND work_row.resource_type = target_resource_type
    AND work_row.resource_id = target_resource_id
    AND work_row.work_version = expected_work_version
    AND work_row.allocation_id IS NULL
    AND work_row.data_classification = 'synthetic'
  FOR UPDATE;

  IF selected_state IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cutover work changed after external token derivation';
  END IF;

  IF selected_state = 'live' THEN
    INSERT INTO private_data.resource_id_registry (
      allocation_id,
      privacy_domain_id,
      organization_id,
      resource_type,
      resource_id,
      resource_token,
      lifecycle_state,
      registered_at
    ) VALUES (
      target_allocation_id,
      target_privacy_domain_id,
      target_organization_id,
      target_resource_type,
      target_resource_id,
      target_resource_token,
      'live',
      selected_captured_at
    );
  ELSE
    INSERT INTO private_data.resource_id_registry (
      allocation_id,
      privacy_domain_id,
      organization_id,
      resource_type,
      resource_id,
      resource_token,
      lifecycle_state,
      registered_at,
      tombstoned_at
    ) VALUES (
      target_allocation_id,
      target_privacy_domain_id,
      NULL,
      target_resource_type,
      NULL,
      target_resource_token,
      'deleted',
      selected_captured_at,
      selected_deleted_at
    );
  END IF;

  UPDATE private_data.resource_identifier_cutover_work
  SET
    allocation_id = target_allocation_id,
    backfilled_at = transaction_timestamp()
  WHERE organization_id = target_organization_id
    AND resource_type = target_resource_type
    AND resource_id = target_resource_id
    AND work_version = expected_work_version
    AND allocation_id IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cutover work changed while applying its token';
  END IF;

  IF selected_state = 'live' THEN
    IF target_resource_type = 'thesis' THEN
      UPDATE private_data.theses
      SET registered_allocation_id = target_allocation_id
      WHERE organization_id = target_organization_id
        AND id = target_resource_id
        AND registered_allocation_id IS NULL
        AND data_classification = 'synthetic';
    ELSIF target_resource_type = 'alert' THEN
      UPDATE private_data.alert_rules
      SET registered_allocation_id = target_allocation_id
      WHERE organization_id = target_organization_id
        AND id = target_resource_id
        AND registered_allocation_id IS NULL
        AND data_classification = 'synthetic';
    ELSE
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'cutover work has an unsupported resource type';
    END IF;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'cutover live resource changed while applying its token';
    END IF;
  END IF;

  RETURN target_allocation_id;
END;
$function$;

CREATE FUNCTION private_data.inspect_resource_identifier_cutover()
RETURNS TABLE (
  capture_epoch bigint,
  pending_rows bigint,
  live_rows bigint,
  deleted_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private_data
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(
    818476709640328254::bigint
  );

  RETURN QUERY SELECT
    control_row.capture_epoch,
    count(*) FILTER (WHERE work_row.allocation_id IS NULL),
    count(*) FILTER (WHERE work_row.desired_state = 'live'),
    count(*) FILTER (WHERE work_row.desired_state = 'deleted')
  FROM private_data.resource_identifier_cutover_control AS control_row
  LEFT JOIN private_data.resource_identifier_cutover_work AS work_row
    ON work_row.data_classification = 'synthetic'
  WHERE control_row.singleton
    AND control_row.lifecycle_state = 'capturing'
    AND control_row.data_classification = 'synthetic'
  GROUP BY control_row.capture_epoch;
END;
$function$;

-- The renderer replaces this marker with the exact B13 target allocation
-- function body bound by this plan's target manifest.
-- __POPULATED_CUTOVER_TARGET_ALLOCATION_FUNCTION__

REVOKE ALL ON FUNCTION private_data.guard_resource_id_registry_cutover()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.guard_live_resource_identity_cutover()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.capture_resource_identifier_cutover()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.create_resource_privacy_domain_for_cutover(
  uuid,
  uuid,
  uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION
  private_data.claim_resource_identifier_cutover_batch()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.backfill_resource_identifier_cutover(
  uuid,
  uuid,
  text,
  uuid,
  bigint,
  uuid,
  bytea
) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.inspect_resource_identifier_cutover()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.allocate_resource_identifier(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  bytea
) FROM PUBLIC;

REVOKE ALL ON TABLE private_data.resource_privacy_domains FROM PUBLIC;
REVOKE ALL ON TABLE private_data.resource_id_registry FROM PUBLIC;
REVOKE ALL ON TABLE private_data.resource_identifier_cutover_control
  FROM PUBLIC;
REVOKE ALL ON TABLE private_data.resource_identifier_cutover_work
  FROM PUBLIC;

GRANT USAGE ON SCHEMA private_data
  TO research_cockpit_populated_cutover;
GRANT EXECUTE ON FUNCTION
  private_data.create_resource_privacy_domain_for_cutover(uuid, uuid, uuid)
  TO research_cockpit_populated_cutover;
GRANT EXECUTE ON FUNCTION
  private_data.claim_resource_identifier_cutover_batch()
  TO research_cockpit_populated_cutover;
GRANT EXECUTE ON FUNCTION private_data.backfill_resource_identifier_cutover(
  uuid,
  uuid,
  text,
  uuid,
  bigint,
  uuid,
  bytea
) TO research_cockpit_populated_cutover;
GRANT EXECUTE ON FUNCTION private_data.inspect_resource_identifier_cutover()
  TO research_cockpit_populated_cutover;
