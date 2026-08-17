SET SESSION AUTHORIZATION research_cockpit_test_seed;

BEGIN;

INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'synthetic-alpha',
    'Synthetic Alpha Research',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'synthetic-beta',
    'Synthetic Beta Research',
    '2020-01-01T00:00:00Z'
  );

INSERT INTO private_data.principals (
  id,
  subject,
  display_name,
  active,
  created_at
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'synthetic:alpha-owner',
    'Synthetic Alpha Owner',
    true,
    '2020-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'synthetic:beta-owner',
    'Synthetic Beta Owner',
    true,
    '2020-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'synthetic:inactive',
    'Synthetic Inactive Principal',
    false,
    '2020-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'synthetic:no-membership',
    'Synthetic No Membership Principal',
    true,
    '2020-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'synthetic:expired-member',
    'Synthetic Expired Member',
    true,
    '2020-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'synthetic:future-member',
    'Synthetic Future Member',
    true,
    '2020-01-01T00:00:00Z'
  );

INSERT INTO private_data.organization_principals (
  organization_id,
  principal_id,
  associated_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    '2020-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    '2020-01-01T00:00:00Z'
  );

INSERT INTO private_data.memberships (
  organization_id,
  principal_id,
  role,
  active_from,
  active_to
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'owner',
    '2020-01-01T00:00:00Z',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'owner',
    '2020-01-01T00:00:00Z',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'viewer',
    '2020-01-01T00:00:00Z',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'viewer',
    '2020-01-01T00:00:00Z',
    '2021-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    'viewer',
    '9998-01-01T00:00:00Z',
    NULL
  );

INSERT INTO private_data.entitlements (
  organization_id,
  id,
  principal_id,
  capability,
  active_from,
  active_to
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    NULL,
    'research.synthetic.read',
    '2020-01-01T00:00:00Z',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    NULL,
    'research.synthetic.read',
    '2020-01-01T00:00:00Z',
    NULL
  );

INSERT INTO shared_data.rights_policies (
  policy_id,
  policy_version,
  territory,
  expires_at,
  created_at
)
VALUES
  (
    'synthetic.full',
    '1.0.0',
    'demo_only',
    NULL,
    '2020-01-01T00:00:00Z'
  ),
  (
    'synthetic.full',
    '2.0.0',
    'demo_only',
    NULL,
    '2020-01-01T00:00:00Z'
  ),
  (
    'synthetic.display-only',
    '1.0.0',
    'demo_only',
    NULL,
    '2020-01-01T00:00:00Z'
  ),
  (
    'synthetic.expired',
    '1.0.0',
    'demo_only',
    '2021-01-01T00:00:00Z',
    '2020-01-01T00:00:00Z'
  ),
  (
    'synthetic.denied',
    '1.0.0',
    'demo_only',
    NULL,
    '2020-01-01T00:00:00Z'
  );

INSERT INTO shared_data.rights_grants (
  policy_id,
  policy_version,
  purpose,
  channel,
  allowed
)
VALUES
  ('synthetic.full', '1.0.0', 'display', 'api', true),
  ('synthetic.full', '1.0.0', 'derive', 'api', true),
  ('synthetic.full', '1.0.0', 'alert', 'local_alert', true),
  ('synthetic.display-only', '1.0.0', 'display', 'api', true),
  ('synthetic.display-only', '1.0.0', 'derive', 'api', false),
  ('synthetic.display-only', '1.0.0', 'alert', 'local_alert', false),
  ('synthetic.expired', '1.0.0', 'display', 'api', true),
  ('synthetic.expired', '1.0.0', 'derive', 'api', true),
  ('synthetic.expired', '1.0.0', 'alert', 'local_alert', true),
  ('synthetic.denied', '1.0.0', 'display', 'api', false),
  ('synthetic.denied', '1.0.0', 'derive', 'api', false),
  ('synthetic.denied', '1.0.0', 'alert', 'local_alert', false);

INSERT INTO shared_data.issuers (id, legal_name, domicile_country, created_at)
VALUES (
  'issuer-syn1',
  'Synthetic Instruments Corporation',
  'US',
  '2020-01-01T00:00:00Z'
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
  'security-syn1',
  'issuer-syn1',
  'common_stock',
  'Synthetic Instruments Common Stock',
  'USD',
  '2020-01-01T00:00:00Z'
);

INSERT INTO shared_data.share_classes (
  id,
  security_id,
  class_label,
  created_at
)
VALUES (
  'share-class-syn1',
  'security-syn1',
  'Synthetic Class A',
  '2020-01-01T00:00:00Z'
);

INSERT INTO shared_data.exchanges (id, mic, name, timezone, created_at)
VALUES (
  'exchange-synx',
  'SYNX',
  'Synthetic Exchange',
  'America/Chicago',
  '2020-01-01T00:00:00Z'
);

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
VALUES (
  'listing-syn1',
  'share-class-syn1',
  'exchange-synx',
  'USD',
  '2020-01-01T00:00:00Z',
  NULL,
  '2020-01-01T00:00:00Z',
  NULL
);

INSERT INTO shared_data.symbol_history (
  listing_id,
  symbol,
  effective_from,
  effective_to,
  system_from,
  system_to
)
VALUES (
  'listing-syn1',
  'SYN1',
  '2020-01-01T00:00:00Z',
  NULL,
  '2020-01-01T00:00:00Z',
  NULL
);

INSERT INTO shared_data.evidence (
  id,
  title,
  source_type,
  document_id,
  locator,
  excerpt,
  content_hash,
  available_at,
  known_from,
  known_to,
  rights_policy_id,
  rights_policy_version,
  created_at
)
VALUES
  (
    'evidence-full-v1',
    'Synthetic full-rights record',
    'synthetic_filing',
    'synthetic-document-1',
    'synthetic locator 1',
    'Synthetic evidence for the acceptance fixture.',
    'sha256:0000000000000000000000000000000000000000000000000000000000000001',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:01Z',
    NULL,
    'synthetic.full',
    '1.0.0',
    '2024-01-01T00:00:02Z'
  ),
  (
    'evidence-full-v2',
    'Synthetic ungranted policy-version record',
    'synthetic_filing',
    'synthetic-document-2',
    'synthetic locator 2',
    'Synthetic evidence with a distinct ungranted policy version.',
    'sha256:0000000000000000000000000000000000000000000000000000000000000002',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:01Z',
    NULL,
    'synthetic.full',
    '2.0.0',
    '2024-01-01T00:00:02Z'
  ),
  (
    'evidence-display-only',
    'Synthetic display-only record',
    'synthetic_filing',
    'synthetic-document-3',
    'synthetic locator 3',
    'Synthetic evidence limited to display use.',
    'sha256:0000000000000000000000000000000000000000000000000000000000000003',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:01Z',
    NULL,
    'synthetic.display-only',
    '1.0.0',
    '2024-01-01T00:00:02Z'
  ),
  (
    'evidence-expired',
    'Synthetic expired-rights record',
    'synthetic_filing',
    'synthetic-document-4',
    'synthetic locator 4',
    'Synthetic evidence with an expired policy.',
    'sha256:0000000000000000000000000000000000000000000000000000000000000004',
    '2020-01-01T00:00:00Z',
    '2020-01-01T00:00:01Z',
    NULL,
    'synthetic.expired',
    '1.0.0',
    '2020-01-01T00:00:02Z'
  ),
  (
    'evidence-denied',
    'Synthetic denied-rights record',
    'synthetic_filing',
    'synthetic-document-5',
    'synthetic locator 5',
    'Synthetic evidence with explicit denials.',
    'sha256:0000000000000000000000000000000000000000000000000000000000000005',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:01Z',
    NULL,
    'synthetic.denied',
    '1.0.0',
    '2024-01-01T00:00:02Z'
  );

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
VALUES
  (
    'fact-full-v1',
    'security-syn1',
    'synthetic_full_v1',
    '0000000000000000000000000000000000000000000000000000000000000001',
    100.000000000000,
    2,
    'USD_MILLIONS',
    'USD',
    '2024-01-01',
    '2024-12-31',
    '2025-01-01T00:00:01Z',
    NULL,
    '2025-01-01T00:00:02Z',
    NULL,
    '2025-01-01T00:00:00Z',
    'evidence-full-v1',
    'synthetic.full',
    '1.0.0',
    'verified_fixture',
    '2025-01-01T00:00:02Z'
  ),
  (
    'fact-display-only',
    'security-syn1',
    'synthetic_display_only',
    '0000000000000000000000000000000000000000000000000000000000000002',
    200.000000000000,
    2,
    'USD_MILLIONS',
    'USD',
    '2024-01-01',
    '2024-12-31',
    '2025-01-01T00:00:01Z',
    NULL,
    '2025-01-01T00:00:02Z',
    NULL,
    '2025-01-01T00:00:00Z',
    'evidence-display-only',
    'synthetic.display-only',
    '1.0.0',
    'verified_fixture',
    '2025-01-01T00:00:02Z'
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
  'synthetic-margin',
  '1.0.0',
  'Synthetic margin',
  'synthetic_full_v1 / synthetic_display_only',
  ARRAY['synthetic_full_v1', 'synthetic_display_only'],
  'ratio',
  'Synthetic acceptance-only metric definition.',
  '2025-01-01T00:00:02Z'
);

INSERT INTO private_data.resource_id_registry (
  organization_id,
  resource_type,
  resource_id,
  lifecycle_state,
  registered_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    'live',
    '2025-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    'live',
    '2025-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'alert',
    '40000000-0000-4000-8000-000000000002',
    'live',
    '2025-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'alert',
    '40000000-0000-4000-8000-000000000002',
    'live',
    '2025-01-01T00:00:00Z'
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
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'listing-syn1',
    'Synthetic Alpha thesis.',
    'Synthetic Alpha evidence note.',
    'Synthetic Alpha risk.',
    'Synthetic Alpha invalidation.',
    '20000000-0000-4000-8000-000000000001',
    '2025-01-01T00:00:00Z',
    '20000000-0000-4000-8000-000000000001',
    '2025-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'listing-syn1',
    'Synthetic Beta thesis.',
    'Synthetic Beta evidence note.',
    'Synthetic Beta risk.',
    'Synthetic Beta invalidation.',
    '20000000-0000-4000-8000-000000000002',
    '2025-01-01T00:00:00Z',
    '20000000-0000-4000-8000-000000000002',
    '2025-01-01T00:00:00Z'
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
  state,
  created_by,
  created_at,
  updated_by,
  updated_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    'listing-syn1',
    'synthetic-margin',
    '1.0.0',
    'above',
    50.000000000000,
    2,
    'active',
    '20000000-0000-4000-8000-000000000001',
    '2025-01-01T00:00:00Z',
    '20000000-0000-4000-8000-000000000001',
    '2025-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'listing-syn1',
    'synthetic-margin',
    '1.0.0',
    'below',
    25.000000000000,
    2,
    'active',
    '20000000-0000-4000-8000-000000000002',
    '2025-01-01T00:00:00Z',
    '20000000-0000-4000-8000-000000000002',
    '2025-01-01T00:00:00Z'
  );

INSERT INTO private_data.idempotency_records (
  organization_id,
  principal_id,
  operation,
  idempotency_key,
  request_fingerprint,
  resource_type,
  resource_id,
  resource_version,
  created_at,
  expires_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'thesis.create',
    'synthetic-alpha-key',
    'sha256:0000000000000000000000000000000000000000000000000000000000000001',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    1,
    '2025-01-01T00:00:00Z',
    '9998-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'thesis.create',
    'synthetic-beta-key',
    'sha256:0000000000000000000000000000000000000000000000000000000000000002',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    1,
    '2025-01-01T00:00:00Z',
    '9998-01-01T00:00:00Z'
  );

INSERT INTO private_data.audit_events (
  organization_id,
  id,
  principal_id,
  request_id,
  action,
  resource_type,
  resource_id,
  resource_version,
  decision,
  reason_code,
  occurred_at,
  retention_until
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'synthetic-alpha-request',
    'thesis.created',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    1,
    'allowed',
    'synthetic_fixture',
    '2025-01-01T00:00:00Z',
    '9998-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'synthetic-beta-request',
    'thesis.created',
    'thesis',
    '40000000-0000-4000-8000-000000000001',
    1,
    'allowed',
    'synthetic_fixture',
    '2025-01-01T00:00:00Z',
    '9998-01-01T00:00:00Z'
  );

COMMIT;

RESET SESSION AUTHORIZATION;
