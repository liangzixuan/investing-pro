-- Fixed synthetic populated source at the exact v2 pre-0005 branch.

INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    'cutover-alpha',
    'Cutover Alpha',
    '2026-08-01T00:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    'cutover-beta',
    'Cutover Beta',
    '2026-08-01T00:00:00Z'
  );

INSERT INTO private_data.principals (
  id,
  subject,
  display_name,
  created_at
)
VALUES
  (
    '14000000-0000-4000-8000-000000000101',
    'synthetic:cutover-alpha-owner',
    'Cutover Alpha Owner',
    '2026-08-01T00:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000102',
    'synthetic:cutover-beta-owner',
    'Cutover Beta Owner',
    '2026-08-01T00:00:00Z'
  );

INSERT INTO private_data.organization_principals (
  organization_id,
  principal_id,
  associated_at
)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000101',
    '2026-08-01T00:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000102',
    '2026-08-01T00:00:00Z'
  );

INSERT INTO private_data.memberships (
  organization_id,
  principal_id,
  role,
  active_from
)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000101',
    'owner',
    '2026-08-01T00:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000102',
    'owner',
    '2026-08-01T00:00:00Z'
  );

INSERT INTO private_data.entitlements (
  organization_id,
  id,
  principal_id,
  capability,
  active_from
)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000111',
    '14000000-0000-4000-8000-000000000101',
    'research.synthetic.read',
    '2026-08-01T00:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000112',
    '14000000-0000-4000-8000-000000000102',
    'research.synthetic.read',
    '2026-08-01T00:00:00Z'
  );

INSERT INTO shared_data.issuers (
  id,
  legal_name,
  domicile_country,
  created_at
)
VALUES (
  'issuer-cutover-synthetic',
  'Cutover Synthetic Issuer',
  'US',
  '2026-08-01T00:00:00Z'
);

INSERT INTO shared_data.securities (
  id,
  issuer_id,
  security_type,
  name,
  currency_code,
  created_at
)
VALUES (
  'security-cutover-synthetic',
  'issuer-cutover-synthetic',
  'common_stock',
  'Cutover Synthetic Security',
  'USD',
  '2026-08-01T00:00:00Z'
);

INSERT INTO shared_data.share_classes (
  id,
  security_id,
  class_label,
  created_at
)
VALUES (
  'share-class-cutover-synthetic',
  'security-cutover-synthetic',
  'Common',
  '2026-08-01T00:00:00Z'
);

INSERT INTO shared_data.exchanges (id, mic, name, timezone, created_at)
VALUES (
  'exchange-cutover-synthetic',
  'XCUT',
  'Cutover Synthetic Exchange',
  'America/Chicago',
  '2026-08-01T00:00:00Z'
);

INSERT INTO shared_data.listings (
  id,
  share_class_id,
  exchange_id,
  currency_code,
  effective_from,
  system_from
)
VALUES (
  'listing-cutover-synthetic',
  'share-class-cutover-synthetic',
  'exchange-cutover-synthetic',
  'USD',
  '2026-08-01T00:00:00Z',
  '2026-08-01T00:00:00Z'
);

INSERT INTO shared_data.metric_definitions (
  definition_id,
  definition_version,
  label,
  formula,
  input_concepts,
  unit_code,
  disclosure,
  created_at
)
VALUES (
  'metric-cutover-synthetic',
  '1.0.0',
  'Cutover synthetic metric',
  'synthetic_input',
  ARRAY['synthetic_input'],
  'ratio',
  'Synthetic-only populated cutover fixture metric.',
  '2026-08-01T00:00:00Z'
);

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
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000201',
    'listing-cutover-synthetic',
    'Alpha populated thesis survives the keyed cutover.',
    'Synthetic populated-cutover fixture evidence.',
    'Synthetic fixture risk.',
    'Synthetic fixture invalidation.',
    '14000000-0000-4000-8000-000000000101',
    '2026-08-01T01:00:00Z',
    '14000000-0000-4000-8000-000000000101',
    '2026-08-01T01:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000203',
    'listing-cutover-synthetic',
    'Beta populated thesis remains isolated during cutover.',
    'Synthetic populated-cutover fixture evidence.',
    'Synthetic fixture risk.',
    'Synthetic fixture invalidation.',
    '14000000-0000-4000-8000-000000000102',
    '2026-08-01T01:00:00Z',
    '14000000-0000-4000-8000-000000000102',
    '2026-08-01T01:00:00Z'
  );

INSERT INTO private_data.alert_rules (
  organization_id,
  id,
  instrument_id,
  metric_definition_id,
  metric_definition_version,
  operator,
  threshold_numeric,
  threshold_scale,
  created_by,
  created_at,
  updated_by,
  updated_at
)
VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000202',
    'listing-cutover-synthetic',
    'metric-cutover-synthetic',
    '1.0.0',
    'above',
    10,
    0,
    '14000000-0000-4000-8000-000000000101',
    '2026-08-01T01:00:00Z',
    '14000000-0000-4000-8000-000000000101',
    '2026-08-01T01:00:00Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000204',
    'listing-cutover-synthetic',
    'metric-cutover-synthetic',
    '1.0.0',
    'below',
    5,
    0,
    '14000000-0000-4000-8000-000000000102',
    '2026-08-01T01:00:00Z',
    '14000000-0000-4000-8000-000000000102',
    '2026-08-01T01:00:00Z'
  );
