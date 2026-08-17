-- Versioned v2 application migration. The immutable migrations/ lane remains
-- a separate historical clean-bootstrap contract and is not rewritten here.

CREATE TABLE private_data.organizations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE private_data.principals (
  id uuid PRIMARY KEY,
  subject text NOT NULL UNIQUE CHECK (char_length(subject) BETWEEN 1 AND 200),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
  active boolean NOT NULL DEFAULT true,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE private_data.organization_principals (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  principal_id uuid NOT NULL REFERENCES private_data.principals(id),
  associated_at timestamptz NOT NULL,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, principal_id)
);

CREATE TABLE private_data.memberships (
  organization_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'researcher', 'viewer')),
  active_from timestamptz NOT NULL,
  active_to timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, principal_id, active_from),
  FOREIGN KEY (organization_id, principal_id)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  CHECK (active_to IS NULL OR active_to > active_from)
);

CREATE TABLE private_data.entitlements (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  id uuid NOT NULL,
  principal_id uuid,
  capability text NOT NULL CHECK (char_length(capability) BETWEEN 1 AND 120),
  active_from timestamptz NOT NULL,
  active_to timestamptz,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, principal_id, capability, active_from),
  FOREIGN KEY (organization_id, principal_id)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ) MATCH SIMPLE,
  CHECK (active_to IS NULL OR active_to > active_from)
);

CREATE TABLE shared_data.rights_policies (
  policy_id text NOT NULL,
  policy_version text NOT NULL CHECK (
    policy_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  territory text NOT NULL CHECK (territory = 'demo_only'),
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (policy_id, policy_version)
);

CREATE TABLE shared_data.rights_grants (
  policy_id text NOT NULL,
  policy_version text NOT NULL,
  purpose text NOT NULL CHECK (
    purpose IN ('display', 'derive', 'alert', 'export', 'ai')
  ),
  channel text NOT NULL CHECK (channel IN ('api', 'web', 'local_alert')),
  allowed boolean NOT NULL,
  PRIMARY KEY (policy_id, policy_version, purpose, channel),
  FOREIGN KEY (policy_id, policy_version)
    REFERENCES shared_data.rights_policies(policy_id, policy_version)
);

CREATE TABLE shared_data.issuers (
  id text PRIMARY KEY,
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 240),
  domicile_country char(2) NOT NULL CHECK (domicile_country ~ '^[A-Z]{2}$'),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE shared_data.securities (
  id text PRIMARY KEY,
  issuer_id text NOT NULL REFERENCES shared_data.issuers(id),
  security_type text NOT NULL CHECK (security_type = 'common_stock'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
  currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE shared_data.share_classes (
  id text PRIMARY KEY,
  security_id text NOT NULL REFERENCES shared_data.securities(id),
  class_label text NOT NULL CHECK (char_length(class_label) BETWEEN 1 AND 80),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE shared_data.exchanges (
  id text PRIMARY KEY,
  mic char(4) NOT NULL UNIQUE CHECK (mic ~ '^[A-Z0-9]{4}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  timezone text NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 80),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL
);

CREATE TABLE shared_data.listings (
  id text PRIMARY KEY,
  share_class_id text NOT NULL REFERENCES shared_data.share_classes(id),
  exchange_id text NOT NULL REFERENCES shared_data.exchanges(id),
  currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  system_from timestamptz NOT NULL,
  system_to timestamptz,
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (system_to IS NULL OR system_to > system_from)
);

CREATE TABLE shared_data.symbol_history (
  listing_id text NOT NULL REFERENCES shared_data.listings(id),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9.-]{1,20}$'),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  system_from timestamptz NOT NULL,
  system_to timestamptz,
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  PRIMARY KEY (listing_id, symbol, system_from),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (system_to IS NULL OR system_to > system_from)
);

CREATE TABLE shared_data.evidence (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  source_type text NOT NULL CHECK (
    source_type IN ('synthetic_filing', 'synthetic_price_record')
  ),
  document_id text NOT NULL,
  locator text NOT NULL,
  excerpt text NOT NULL CHECK (char_length(excerpt) BETWEEN 1 AND 2000),
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  available_at timestamptz NOT NULL,
  known_from timestamptz NOT NULL,
  known_to timestamptz,
  rights_policy_id text NOT NULL,
  rights_policy_version text NOT NULL,
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL,
  UNIQUE (id, rights_policy_id, rights_policy_version),
  FOREIGN KEY (rights_policy_id, rights_policy_version)
    REFERENCES shared_data.rights_policies(policy_id, policy_version),
  CHECK (known_to IS NULL OR known_to > known_from),
  CHECK (available_at <= known_from)
);

CREATE TABLE shared_data.financial_facts (
  id text PRIMARY KEY,
  security_id text NOT NULL REFERENCES shared_data.securities(id),
  concept_key text NOT NULL CHECK (concept_key ~ '^[a-z][a-z0-9_]{0,119}$'),
  fact_identity_hash char(64) NOT NULL CHECK (
    fact_identity_hash ~ '^[0-9a-f]{64}$'
  ),
  value_numeric numeric(38, 12) NOT NULL,
  value_scale smallint NOT NULL CHECK (value_scale BETWEEN 0 AND 12),
  unit_code text NOT NULL CHECK (char_length(unit_code) BETWEEN 1 AND 40),
  currency_code char(3) CHECK (
    currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'
  ),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(dimensions) = 'object'
  ),
  period_start date,
  period_end date NOT NULL,
  known_from timestamptz NOT NULL,
  known_to timestamptz,
  system_from timestamptz NOT NULL,
  system_to timestamptz,
  available_at timestamptz NOT NULL,
  evidence_id text NOT NULL,
  rights_policy_id text NOT NULL,
  rights_policy_version text NOT NULL,
  quality_state text NOT NULL CHECK (
    quality_state IN ('verified_fixture', 'restated_fixture', 'quarantined_fixture')
  ),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL,
  FOREIGN KEY (evidence_id, rights_policy_id, rights_policy_version)
    REFERENCES shared_data.evidence(id, rights_policy_id, rights_policy_version),
  CHECK (period_start IS NULL OR period_end >= period_start),
  CHECK (known_to IS NULL OR known_to > known_from),
  CHECK (system_to IS NULL OR system_to > system_from),
  CHECK (available_at <= known_from),
  CHECK (known_from <= system_from)
);

CREATE TABLE shared_data.metric_definitions (
  definition_id text NOT NULL,
  definition_version text NOT NULL CHECK (
    definition_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  formula text NOT NULL CHECK (char_length(formula) BETWEEN 1 AND 1000),
  input_concepts text[] NOT NULL CHECK (cardinality(input_concepts) > 0),
  unit_code text NOT NULL CHECK (char_length(unit_code) BETWEEN 1 AND 40),
  disclosure text NOT NULL CHECK (char_length(disclosure) BETWEEN 1 AND 2000),
  classification text NOT NULL DEFAULT 'synthetic'
    CHECK (classification = 'synthetic'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (definition_id, definition_version)
);

CREATE TABLE private_data.theses (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  id uuid NOT NULL,
  instrument_id text NOT NULL REFERENCES shared_data.listings(id),
  claim text NOT NULL CHECK (char_length(claim) BETWEEN 1 AND 4000),
  evidence_note text NOT NULL CHECK (
    char_length(evidence_note) BETWEEN 1 AND 8000
  ),
  risks text NOT NULL CHECK (char_length(risks) BETWEEN 1 AND 8000),
  invalidation text NOT NULL CHECK (char_length(invalidation) <= 4000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, created_by)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  FOREIGN KEY (organization_id, updated_by)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  CHECK (updated_at >= created_at)
);

CREATE TABLE private_data.alert_rules (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  id uuid NOT NULL,
  instrument_id text NOT NULL REFERENCES shared_data.listings(id),
  metric_definition_id text NOT NULL,
  metric_definition_version text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('above', 'below')),
  threshold_numeric numeric(38, 12) NOT NULL,
  threshold_scale smallint NOT NULL CHECK (threshold_scale BETWEEN 0 AND 12),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (metric_definition_id, metric_definition_version)
    REFERENCES shared_data.metric_definitions(definition_id, definition_version),
  FOREIGN KEY (organization_id, created_by)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  FOREIGN KEY (organization_id, updated_by)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  CHECK (updated_at >= created_at)
);

CREATE TABLE private_data.idempotency_records (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  principal_id uuid NOT NULL,
  operation text NOT NULL CHECK (char_length(operation) BETWEEN 1 AND 120),
  idempotency_key text NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
  ),
  request_fingerprint text NOT NULL CHECK (
    request_fingerprint ~ '^sha256:[0-9a-f]{64}$'
  ),
  resource_type text NOT NULL CHECK (
    resource_type IN ('thesis', 'alert')
  ),
  resource_id uuid NOT NULL,
  resource_version integer CHECK (resource_version IS NULL OR resource_version > 0),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (
    organization_id,
    principal_id,
    operation,
    idempotency_key
  ),
  FOREIGN KEY (organization_id, principal_id)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  CHECK (expires_at > created_at)
);

CREATE TABLE private_data.audit_events (
  organization_id uuid NOT NULL REFERENCES private_data.organizations(id),
  id uuid NOT NULL,
  principal_id uuid NOT NULL,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  action text NOT NULL CHECK (
    action IN (
      'thesis.created',
      'thesis.updated',
      'thesis.deleted',
      'alert.created',
      'alert.updated',
      'alert.deleted',
      'research.exported',
      'authorization.denied'
    )
  ),
  resource_type text NOT NULL CHECK (
    resource_type IN ('thesis', 'alert', 'research_export', 'authorization')
  ),
  resource_id text NOT NULL CHECK (char_length(resource_id) BETWEEN 1 AND 200),
  resource_version integer CHECK (resource_version IS NULL OR resource_version > 0),
  decision text NOT NULL CHECK (decision IN ('allowed', 'denied')),
  reason_code text NOT NULL CHECK (char_length(reason_code) BETWEEN 1 AND 80),
  occurred_at timestamptz NOT NULL,
  retention_until timestamptz NOT NULL,
  data_classification text NOT NULL DEFAULT 'synthetic'
    CHECK (data_classification = 'synthetic'),
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, principal_id)
    REFERENCES private_data.organization_principals(
      organization_id,
      principal_id
    ),
  CHECK (retention_until > occurred_at)
);


REVOKE ALL ON ALL TABLES IN SCHEMA shared_data FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private_data FROM PUBLIC;
