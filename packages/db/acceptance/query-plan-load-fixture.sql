SET SESSION AUTHORIZATION research_cockpit_test_seed;

BEGIN;

INSERT INTO shared_data.securities (
  id,
  issuer_id,
  security_type,
  name,
  currency_code,
  created_at
)
SELECT
  'security-b12-' || lpad(series.listing_no::text, 6, '0'),
  'issuer-syn1',
  'common_stock',
  'B12 synthetic security ' || series.listing_no::text,
  'USD',
  '2025-01-01T00:00:00Z'::timestamptz
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no);

INSERT INTO shared_data.share_classes (
  id,
  security_id,
  class_label,
  created_at
)
SELECT
  'share-class-b12-' || lpad(series.listing_no::text, 6, '0'),
  'security-b12-' || lpad(series.listing_no::text, 6, '0'),
  'B12 Class ' || series.listing_no::text,
  '2025-01-01T00:00:00Z'::timestamptz
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no);

INSERT INTO shared_data.listings (
  id,
  share_class_id,
  exchange_id,
  currency_code,
  effective_from,
  effective_to,
  system_from,
  system_to
)
SELECT
  'listing-b12-' || lpad(series.listing_no::text, 6, '0'),
  'share-class-b12-' || lpad(series.listing_no::text, 6, '0'),
  'exchange-synx',
  'USD',
  '2025-01-01T00:00:00Z'::timestamptz,
  NULL,
  '2025-01-01T00:00:00Z'::timestamptz,
  NULL
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no);

INSERT INTO shared_data.financial_facts (
  id,
  security_id,
  concept_key,
  fact_identity_hash,
  value_numeric,
  value_scale,
  unit_code,
  currency_code,
  period_start,
  period_end,
  known_from,
  known_to,
  system_from,
  system_to,
  available_at,
  evidence_id,
  rights_policy_id,
  rights_policy_version,
  quality_state,
  created_at
)
SELECT
  'fact-b12-' || lpad(series.listing_no::text, 6, '0') || '-' ||
    lpad(fact.fact_no::text, 2, '0'),
  'security-b12-' || lpad(series.listing_no::text, 6, '0'),
  'b12_concept_' || lpad(fact.fact_no::text, 2, '0'),
  lpad(
    pg_catalog.to_hex(
      1000000 + ((series.listing_no - 1) * 8) + fact.fact_no
    ),
    64,
    '0'
  )::char(64),
  (series.listing_no * 100 + fact.fact_no)::numeric(38, 12),
  2,
  'USD_MILLIONS',
  'USD',
  '2024-01-01'::date,
  '2024-12-31'::date,
  '2025-01-01T00:00:01Z'::timestamptz,
  NULL,
  '2025-01-01T00:00:02Z'::timestamptz,
  NULL,
  '2025-01-01T00:00:00Z'::timestamptz,
  'evidence-full-v1',
  'synthetic.full',
  '1.0.0',
  'verified_fixture',
  '2025-01-01T00:00:02Z'::timestamptz
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no)
CROSS JOIN pg_catalog.generate_series(1, 8) AS fact(fact_no);

INSERT INTO private_data.resource_id_registry (
  organization_id,
  resource_type,
  resource_id,
  lifecycle_state,
  registered_at
)
SELECT
  actor.organization_id::uuid,
  'thesis',
  pg_catalog.format(
    'b120000%s-0000-4000-8000-%s',
    actor.actor_no,
    lpad(series.listing_no::text, 12, '0')
  )::uuid,
  'live',
  '2025-01-01T00:00:00Z'::timestamptz
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no)
CROSS JOIN (VALUES
  (1, '10000000-0000-4000-8000-000000000001'),
  (2, '10000000-0000-4000-8000-000000000002')
) AS actor(actor_no, organization_id);

INSERT INTO private_data.theses (
  organization_id,
  id,
  instrument_id,
  claim,
  evidence_note,
  risks,
  invalidation,
  created_by,
  created_at,
  updated_by,
  updated_at
)
SELECT
  actor.organization_id::uuid,
  pg_catalog.format(
    'b120000%s-0000-4000-8000-%s',
    actor.actor_no,
    lpad(series.listing_no::text, 12, '0')
  )::uuid,
  'listing-b12-' || lpad(series.listing_no::text, 6, '0'),
  'B12 ' || actor.actor_label || ' thesis ' || series.listing_no::text,
  'B12 synthetic evidence note.',
  'B12 synthetic risk.',
  'B12 synthetic invalidation.',
  actor.principal_id::uuid,
  '2025-01-01T00:00:00Z'::timestamptz,
  actor.principal_id::uuid,
  '2025-01-01T00:00:00Z'::timestamptz
FROM pg_catalog.generate_series(1, 2048) AS series(listing_no)
CROSS JOIN (VALUES
  (
    1,
    'alpha',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    2,
    'beta',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  )
) AS actor(actor_no, actor_label, organization_id, principal_id);

COMMIT;

RESET SESSION AUTHORIZATION;
