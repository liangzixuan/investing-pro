INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    'privacy-alpha',
    'Privacy Alpha',
    transaction_timestamp() - interval '2 days'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    'privacy-beta',
    'Privacy Beta',
    transaction_timestamp() - interval '2 days'
  );

INSERT INTO private_data.principals (
  id,
  subject,
  display_name,
  created_at
)
VALUES
  (
    '23000000-0000-4000-8000-000000000001',
    'synthetic:privacy-alpha',
    'Privacy Alpha Owner',
    transaction_timestamp() - interval '2 days'
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    'synthetic:privacy-beta',
    'Privacy Beta Owner',
    transaction_timestamp() - interval '2 days'
  );

INSERT INTO private_data.organization_principals (
  organization_id,
  principal_id,
  associated_at
)
VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 days'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000002',
    transaction_timestamp() - interval '2 days'
  );

INSERT INTO private_data.memberships (
  organization_id,
  principal_id,
  role,
  active_from
)
VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    'owner',
    transaction_timestamp() - interval '2 days'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000002',
    'owner',
    transaction_timestamp() - interval '2 days'
  );

INSERT INTO shared_data.rights_policies (
  policy_id,
  policy_version,
  territory,
  created_at
)
VALUES (
  'privacy-synthetic-policy',
  '1.0.0',
  'demo_only',
  transaction_timestamp() - interval '2 days'
);

INSERT INTO shared_data.issuers (
  id,
  legal_name,
  domicile_country,
  created_at
)
VALUES (
  'issuer-privacy-synthetic',
  'Privacy Synthetic Issuer',
  'US',
  transaction_timestamp() - interval '2 days'
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
  'security-privacy-synthetic',
  'issuer-privacy-synthetic',
  'common_stock',
  'Privacy Synthetic Security',
  'USD',
  transaction_timestamp() - interval '2 days'
);

INSERT INTO shared_data.share_classes (
  id,
  security_id,
  class_label,
  created_at
)
VALUES (
  'share-class-privacy-synthetic',
  'security-privacy-synthetic',
  'Common',
  transaction_timestamp() - interval '2 days'
);

INSERT INTO shared_data.exchanges (
  id,
  mic,
  name,
  timezone,
  created_at
)
VALUES (
  'exchange-privacy-synthetic',
  'XPRV',
  'Privacy Synthetic Exchange',
  'Etc/UTC',
  transaction_timestamp() - interval '2 days'
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
  'listing-privacy-synthetic',
  'share-class-privacy-synthetic',
  'exchange-privacy-synthetic',
  'USD',
  transaction_timestamp() - interval '2 days',
  transaction_timestamp() - interval '2 days'
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
  'privacy-synthetic-metric',
  '1.0.0',
  'Privacy synthetic metric',
  'privacy_synthetic_value',
  ARRAY['privacy_synthetic_value'],
  'ratio',
  'Synthetic privacy-retention acceptance only.',
  transaction_timestamp() - interval '2 days'
);

INSERT INTO private_data.resource_privacy_domains (
  privacy_domain_id,
  organization_id,
  key_reference,
  key_version,
  created_at
)
VALUES
  (
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000011',
    1,
    transaction_timestamp() - interval '2 days'
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000012',
    1,
    transaction_timestamp() - interval '2 days'
  );

SELECT private_data.allocate_resource_identifier(
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    pg_catalog.decode(
      '__PRIVACY_TOKEN_ALPHA_THESIS_HEX__',
      'hex'
    )
  );

SELECT private_data.allocate_resource_identifier(
    '33000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000002',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    pg_catalog.decode(
      '__PRIVACY_TOKEN_BETA_THESIS_HEX__',
      'hex'
    )
  );

SELECT private_data.allocate_resource_identifier(
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000003',
    'alert',
    '53000000-0000-4000-8000-000000000002',
    pg_catalog.decode(
      '__PRIVACY_TOKEN_ALPHA_ALERT_HEX__',
      'hex'
    )
  );

SELECT private_data.allocate_resource_identifier(
    '33000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000004',
    'alert',
    '53000000-0000-4000-8000-000000000002',
    pg_catalog.decode(
      '__PRIVACY_TOKEN_BETA_ALERT_HEX__',
      'hex'
    )
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
  updated_at,
  registered_allocation_id
)
VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',
    'listing-privacy-synthetic',
    'Synthetic Alpha privacy thesis.',
    'Synthetic Alpha privacy evidence.',
    'Synthetic Alpha privacy risk.',
    'Synthetic Alpha privacy invalidation.',
    '23000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 days',
    '23000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 days',
    '43000000-0000-4000-8000-000000000001'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '53000000-0000-4000-8000-000000000001',
    'listing-privacy-synthetic',
    'Synthetic Beta privacy thesis.',
    'Synthetic Beta privacy evidence.',
    'Synthetic Beta privacy risk.',
    'Synthetic Beta privacy invalidation.',
    '23000000-0000-4000-8000-000000000002',
    transaction_timestamp() - interval '2 days',
    '23000000-0000-4000-8000-000000000002',
    transaction_timestamp() - interval '2 days',
    '43000000-0000-4000-8000-000000000002'
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
  updated_at,
  registered_allocation_id
)
VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000002',
    'listing-privacy-synthetic',
    'privacy-synthetic-metric',
    '1.0.0',
    'above',
    10.000000000000,
    2,
    '23000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 days',
    '23000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 days',
    '43000000-0000-4000-8000-000000000003'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '53000000-0000-4000-8000-000000000002',
    'listing-privacy-synthetic',
    'privacy-synthetic-metric',
    '1.0.0',
    'below',
    20.000000000000,
    2,
    '23000000-0000-4000-8000-000000000002',
    transaction_timestamp() - interval '2 days',
    '23000000-0000-4000-8000-000000000002',
    transaction_timestamp() - interval '2 days',
    '43000000-0000-4000-8000-000000000004'
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
    '13000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    'thesis.create',
    'privacy-alpha-expired',
    'sha256:1100000000000000000000000000000000000000000000000000000000000001',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    1,
    transaction_timestamp() - interval '2 days',
    transaction_timestamp() - interval '1 day'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000002',
    'thesis.create',
    'privacy-beta-current',
    'sha256:2200000000000000000000000000000000000000000000000000000000000001',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    1,
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '23 hours'
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
    '13000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    'privacy-alpha-expired',
    'thesis.created',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    1,
    'allowed',
    'privacy_fixture',
    transaction_timestamp() - interval '100 days',
    transaction_timestamp() - interval '10 days'
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '63000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000002',
    'privacy-beta-current',
    'thesis.created',
    'thesis',
    '53000000-0000-4000-8000-000000000001',
    1,
    'allowed',
    'privacy_fixture',
    transaction_timestamp() - interval '89 days',
    transaction_timestamp() + interval '1 day'
  );
