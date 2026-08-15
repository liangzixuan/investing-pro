BEGIN;

CREATE EXTENSION btree_gist WITH SCHEMA shared_data;

ALTER TABLE private_data.memberships
  ADD COLUMN active_window tstzrange GENERATED ALWAYS AS (
    tstzrange(active_from, active_to, '[)')
  ) STORED,
  ADD CONSTRAINT memberships_no_overlap
    EXCLUDE USING gist (
      organization_id WITH =,
      principal_id WITH =,
      active_window WITH &&
    );

ALTER TABLE private_data.entitlements
  ADD COLUMN active_window tstzrange GENERATED ALWAYS AS (
    tstzrange(active_from, active_to, '[)')
  ) STORED;

ALTER TABLE shared_data.listings
  ADD COLUMN effective_window tstzrange GENERATED ALWAYS AS (
    tstzrange(effective_from, effective_to, '[)')
  ) STORED,
  ADD COLUMN system_window tstzrange GENERATED ALWAYS AS (
    tstzrange(system_from, system_to, '[)')
  ) STORED;

ALTER TABLE shared_data.symbol_history
  ADD COLUMN effective_window tstzrange GENERATED ALWAYS AS (
    tstzrange(effective_from, effective_to, '[)')
  ) STORED,
  ADD COLUMN system_window tstzrange GENERATED ALWAYS AS (
    tstzrange(system_from, system_to, '[)')
  ) STORED,
  ADD CONSTRAINT symbol_history_no_system_overlap
    EXCLUDE USING gist (
      listing_id WITH =,
      symbol WITH =,
      system_window WITH &&
    );

ALTER TABLE shared_data.evidence
  ADD COLUMN known_window tstzrange GENERATED ALWAYS AS (
    tstzrange(known_from, known_to, '[)')
  ) STORED;

ALTER TABLE shared_data.financial_facts
  ADD COLUMN known_window tstzrange GENERATED ALWAYS AS (
    tstzrange(known_from, known_to, '[)')
  ) STORED,
  ADD COLUMN system_window tstzrange GENERATED ALWAYS AS (
    tstzrange(system_from, system_to, '[)')
  ) STORED,
  ADD CONSTRAINT financial_facts_no_system_overlap
    EXCLUDE USING gist (
      fact_identity_hash WITH =,
      system_window WITH &&
    );

CREATE INDEX memberships_active_lookup
  ON private_data.memberships (organization_id, principal_id, active_from DESC);
CREATE INDEX entitlements_active_lookup
  ON private_data.entitlements (
    organization_id,
    principal_id,
    capability,
    active_from DESC
  );
CREATE INDEX theses_by_instrument
  ON private_data.theses (organization_id, instrument_id, updated_at DESC);
CREATE INDEX alert_rules_by_instrument
  ON private_data.alert_rules (organization_id, instrument_id, updated_at DESC);
CREATE INDEX idempotency_expiry
  ON private_data.idempotency_records (expires_at);
CREATE INDEX audit_events_retention
  ON private_data.audit_events (organization_id, retention_until);
CREATE INDEX symbol_history_symbol_as_known
  ON shared_data.symbol_history (symbol, system_from DESC, effective_from DESC);
CREATE INDEX evidence_as_known
  ON shared_data.evidence (known_from DESC, available_at DESC);
CREATE INDEX financial_facts_as_known
  ON shared_data.financial_facts (
    security_id,
    concept_key,
    known_from DESC,
    system_from DESC,
    available_at DESC
  );

COMMIT;
