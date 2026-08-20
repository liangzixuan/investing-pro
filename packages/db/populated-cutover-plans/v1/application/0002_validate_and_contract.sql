-- Populated-cutover plan v1 contracts only after the caller has completed
-- external token derivation outside this transaction and supplied the exact
-- observed capture epoch. The wrapper owns the exclusive advisory gate before
-- any relation lock below is requested.

LOCK TABLE ONLY private_data.resource_privacy_domains IN EXCLUSIVE MODE;
LOCK TABLE ONLY private_data.theses IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE ONLY private_data.alert_rules IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE ONLY private_data.resource_identifier_cutover_work
  IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE ONLY private_data.resource_id_registry
  IN SHARE ROW EXCLUSIVE MODE;

DO $populated_cutover_quiescence$
DECLARE
  expected_capture_epoch bigint :=
    __POPULATED_CUTOVER_EXPECTED_CAPTURE_EPOCH__::bigint;
  actual_capture_epoch bigint;
  pending_rows bigint;
BEGIN
  SELECT control_row.capture_epoch
  INTO actual_capture_epoch
  FROM private_data.resource_identifier_cutover_control AS control_row
  WHERE control_row.singleton
    AND control_row.lifecycle_state = 'capturing'
    AND control_row.data_classification = 'synthetic';

  SELECT count(*)
  INTO pending_rows
  FROM private_data.resource_identifier_cutover_work AS work_row
  WHERE work_row.allocation_id IS NULL
    AND work_row.data_classification = 'synthetic';

  IF actual_capture_epoch IS NULL
    OR actual_capture_epoch <> expected_capture_epoch
    OR pending_rows <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'populated cutover capture changed before contract';
  END IF;
END;
$populated_cutover_quiescence$;

DO $populated_cutover_invariants$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM private_data.organizations AS organization_row
    WHERE organization_row.data_classification = 'synthetic'
      AND NOT EXISTS (
        SELECT 1
        FROM private_data.resource_privacy_domains AS domain_row
        WHERE domain_row.organization_id = organization_row.id
          AND domain_row.lifecycle_state = 'active'
          AND domain_row.data_classification = 'synthetic'
      )
  ) OR EXISTS (
    SELECT 1
    FROM private_data.resource_identifier_cutover_work AS work_row
    LEFT JOIN private_data.resource_id_registry AS registry_row
      ON registry_row.allocation_id = work_row.allocation_id
    LEFT JOIN private_data.resource_privacy_domains AS domain_row
      ON domain_row.privacy_domain_id = registry_row.privacy_domain_id
    WHERE work_row.data_classification <> 'synthetic'
      OR work_row.allocation_id IS NULL
      OR work_row.backfilled_at IS NULL
      OR registry_row.allocation_id IS NULL
      OR registry_row.resource_type <> work_row.resource_type
      OR registry_row.data_classification <> 'synthetic'
      OR domain_row.organization_id <> work_row.organization_id
      OR (
        work_row.desired_state = 'live'
        AND (
          registry_row.lifecycle_state <> 'live'
          OR registry_row.organization_id <> work_row.organization_id
          OR registry_row.resource_id <> work_row.resource_id
          OR registry_row.tombstoned_at IS NOT NULL
        )
      )
      OR (
        work_row.desired_state = 'deleted'
        AND (
          registry_row.lifecycle_state <> 'deleted'
          OR registry_row.organization_id IS NOT NULL
          OR registry_row.resource_id IS NOT NULL
          OR registry_row.tombstoned_at IS NULL
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM private_data.resource_id_registry AS registry_row
    WHERE NOT EXISTS (
      SELECT 1
      FROM private_data.resource_identifier_cutover_work AS work_row
      WHERE work_row.allocation_id = registry_row.allocation_id
        AND work_row.data_classification = 'synthetic'
    )
  ) OR EXISTS (
    SELECT 1
    FROM private_data.theses AS thesis_row
    WHERE thesis_row.data_classification = 'synthetic'
      AND NOT EXISTS (
        SELECT 1
        FROM private_data.resource_id_registry AS registry_row
        WHERE registry_row.allocation_id = thesis_row.registered_allocation_id
          AND registry_row.organization_id = thesis_row.organization_id
          AND registry_row.resource_type = 'thesis'
          AND registry_row.resource_id = thesis_row.id
          AND registry_row.lifecycle_state = 'live'
          AND registry_row.data_classification = 'synthetic'
      )
  ) OR EXISTS (
    SELECT 1
    FROM private_data.alert_rules AS alert_row
    WHERE alert_row.data_classification = 'synthetic'
      AND NOT EXISTS (
        SELECT 1
        FROM private_data.resource_id_registry AS registry_row
        WHERE registry_row.allocation_id = alert_row.registered_allocation_id
          AND registry_row.organization_id = alert_row.organization_id
          AND registry_row.resource_type = 'alert'
          AND registry_row.resource_id = alert_row.id
          AND registry_row.lifecycle_state = 'live'
          AND registry_row.data_classification = 'synthetic'
      )
  ) OR EXISTS (
    SELECT 1
    FROM private_data.resource_id_registry AS registry_row
    WHERE registry_row.lifecycle_state = 'live'
      AND registry_row.data_classification = 'synthetic'
      AND (
        (
          registry_row.resource_type = 'thesis'
          AND NOT EXISTS (
            SELECT 1
            FROM private_data.theses AS thesis_row
            WHERE thesis_row.registered_allocation_id =
              registry_row.allocation_id
              AND thesis_row.organization_id = registry_row.organization_id
              AND thesis_row.id = registry_row.resource_id
              AND thesis_row.data_classification = 'synthetic'
          )
        )
        OR (
          registry_row.resource_type = 'alert'
          AND NOT EXISTS (
            SELECT 1
            FROM private_data.alert_rules AS alert_row
            WHERE alert_row.registered_allocation_id =
              registry_row.allocation_id
              AND alert_row.organization_id = registry_row.organization_id
              AND alert_row.id = registry_row.resource_id
              AND alert_row.data_classification = 'synthetic'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'populated cutover invariant validation failed';
  END IF;
END;
$populated_cutover_invariants$;

ALTER TABLE private_data.theses
  VALIDATE CONSTRAINT theses_require_live_private_token;
ALTER TABLE private_data.alert_rules
  VALIDATE CONSTRAINT alert_rules_require_live_private_token;

ALTER TABLE private_data.theses
  ADD CONSTRAINT theses_registered_allocation_present
    CHECK (registered_allocation_id IS NOT NULL) NOT VALID;
ALTER TABLE private_data.alert_rules
  ADD CONSTRAINT alert_rules_registered_allocation_present
    CHECK (registered_allocation_id IS NOT NULL) NOT VALID;

ALTER TABLE private_data.theses
  VALIDATE CONSTRAINT theses_registered_allocation_present;
ALTER TABLE private_data.alert_rules
  VALIDATE CONSTRAINT alert_rules_registered_allocation_present;

ALTER TABLE private_data.theses
  ALTER COLUMN registered_allocation_id SET NOT NULL,
  DROP CONSTRAINT theses_registered_allocation_present;
ALTER TABLE private_data.alert_rules
  ALTER COLUMN registered_allocation_id SET NOT NULL,
  DROP CONSTRAINT alert_rules_registered_allocation_present;

DROP TRIGGER theses_cutover_capture ON private_data.theses;
DROP TRIGGER alert_rules_cutover_capture ON private_data.alert_rules;
DROP TRIGGER theses_cutover_identity_immutable ON private_data.theses;
DROP TRIGGER alert_rules_cutover_identity_immutable
  ON private_data.alert_rules;
DROP TRIGGER resource_id_registry_cutover_guard
  ON private_data.resource_id_registry;

DROP FUNCTION private_data.capture_resource_identifier_cutover();
DROP FUNCTION private_data.guard_live_resource_identity_cutover();
DROP FUNCTION private_data.guard_resource_id_registry_cutover();
DROP FUNCTION private_data.create_resource_privacy_domain_for_cutover(
  uuid,
  uuid,
  uuid
);
DROP FUNCTION private_data.claim_resource_identifier_cutover_batch();
DROP FUNCTION private_data.backfill_resource_identifier_cutover(
  uuid,
  uuid,
  text,
  uuid,
  bigint,
  uuid,
  bytea
);
DROP FUNCTION private_data.inspect_resource_identifier_cutover();

DROP POLICY populated_cutover_owner_organizations
  ON private_data.organizations;
DROP POLICY populated_cutover_owner_theses ON private_data.theses;
DROP POLICY populated_cutover_owner_alert_rules
  ON private_data.alert_rules;
DROP POLICY populated_cutover_owner_privacy_domains
  ON private_data.resource_privacy_domains;
DROP POLICY populated_cutover_owner_registry
  ON private_data.resource_id_registry;
DROP POLICY populated_cutover_owner_control
  ON private_data.resource_identifier_cutover_control;
DROP POLICY populated_cutover_owner_work
  ON private_data.resource_identifier_cutover_work;

DROP TABLE private_data.resource_identifier_cutover_work;
DROP TABLE private_data.resource_identifier_cutover_control;

REVOKE USAGE ON SCHEMA private_data
  FROM research_cockpit_populated_cutover;

-- The renderer replaces this marker with the exact remainder of the B13
-- target lifecycle, excluding the already-installed exact allocation function.
-- __POPULATED_CUTOVER_TARGET_FINALIZATION__
