-- Versioned v2 application migration. The immutable migrations/ lane remains
-- a separate historical clean-bootstrap contract and is not rewritten here.

CREATE FUNCTION private_data.has_active_membership(
  target_organization_id uuid,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, private_data
AS $function$
  SELECT
    target_organization_id = private_data.current_organization_id()
    AND private_data.current_principal_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM private_data.memberships AS membership
      JOIN private_data.principals AS principal
        ON principal.id = membership.principal_id
      WHERE membership.organization_id = target_organization_id
        AND membership.principal_id = private_data.current_principal_id()
        AND principal.active
        AND principal.data_classification = 'synthetic'
        AND membership.role = ANY (allowed_roles)
        AND membership.active_from <= transaction_timestamp()
        AND (
          membership.active_to IS NULL
          OR transaction_timestamp() < membership.active_to
        )
        AND membership.data_classification = 'synthetic'
    )
$function$;

CREATE FUNCTION private_data.has_active_entitlement(
  target_organization_id uuid,
  required_capability text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, private_data
AS $function$
  SELECT
    private_data.has_active_membership(
      target_organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
    AND EXISTS (
      SELECT 1
      FROM private_data.entitlements AS entitlement
      WHERE entitlement.organization_id = target_organization_id
        AND (
          entitlement.principal_id IS NULL
          OR entitlement.principal_id = private_data.current_principal_id()
        )
        AND entitlement.capability = required_capability
        AND entitlement.active_from <= transaction_timestamp()
        AND (
          entitlement.active_to IS NULL
          OR transaction_timestamp() < entitlement.active_to
        )
        AND entitlement.data_classification = 'synthetic'
    )
$function$;

CREATE FUNCTION shared_data.rights_allow_current_use(
  requested_policy_id text,
  requested_policy_version text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, shared_data, private_data
AS $function$
  SELECT
    private_data.current_data_classification() = 'synthetic'
    AND private_data.current_purpose() IS NOT NULL
    AND private_data.current_channel() IS NOT NULL
    AND private_data.current_territory() = 'demo_only'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
    AND EXISTS (
      SELECT 1
      FROM shared_data.rights_policies AS policy
      JOIN shared_data.rights_grants AS rights_grant
        ON rights_grant.policy_id = policy.policy_id
       AND rights_grant.policy_version = policy.policy_version
      WHERE policy.policy_id = requested_policy_id
        AND policy.policy_version = requested_policy_version
        AND policy.classification = 'synthetic'
        AND policy.territory = private_data.current_territory()
        AND (policy.expires_at IS NULL OR transaction_timestamp() < policy.expires_at)
        AND rights_grant.purpose = private_data.current_purpose()
        AND rights_grant.channel = private_data.current_channel()
        AND rights_grant.allowed
    )
$function$;


REVOKE ALL ON FUNCTION private_data.has_active_membership(uuid, text[])
  FROM PUBLIC;
REVOKE ALL ON FUNCTION private_data.has_active_entitlement(uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION shared_data.rights_allow_current_use(text, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private_data.has_active_membership(uuid, text[])
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION private_data.has_active_entitlement(uuid, text)
  TO research_cockpit_runtime;
GRANT EXECUTE ON FUNCTION shared_data.rights_allow_current_use(text, text)
  TO research_cockpit_runtime;

ALTER TABLE private_data.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.principals FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.organization_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.organization_principals FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.theses FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.alert_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.idempotency_records FORCE ROW LEVEL SECURITY;
ALTER TABLE private_data.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data.audit_events FORCE ROW LEVEL SECURITY;

ALTER TABLE shared_data.rights_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.rights_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.rights_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.rights_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.issuers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.issuers FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.securities FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.share_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.share_classes FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.exchanges FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.listings FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.symbol_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.symbol_history FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.financial_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.financial_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_data.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data.metric_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY principals_read_self ON private_data.principals
  FOR SELECT TO research_cockpit_runtime
  USING (
    id = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND active
  );

CREATE POLICY memberships_read_self ON private_data.memberships
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND principal_id = private_data.current_principal_id()
    AND active_from <= transaction_timestamp()
    AND (
      active_to IS NULL
      OR transaction_timestamp() < active_to
    )
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.principals AS current_principal
      WHERE current_principal.id = private_data.current_principal_id()
        AND current_principal.active
        AND current_principal.data_classification = 'synthetic'
    )
  );

CREATE POLICY organization_principals_read_self
  ON private_data.organization_principals
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND principal_id = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.memberships AS active_membership
      WHERE active_membership.organization_id = organization_principals.organization_id
        AND active_membership.principal_id = organization_principals.principal_id
        AND active_membership.active_from <= transaction_timestamp()
        AND (
          active_membership.active_to IS NULL
          OR transaction_timestamp() < active_membership.active_to
        )
        AND active_membership.data_classification = 'synthetic'
    )
  );

CREATE POLICY organizations_read_member ON private_data.organizations
  FOR SELECT TO research_cockpit_runtime
  USING (
    data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

CREATE POLICY entitlements_read_current ON private_data.entitlements
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND (
      principal_id IS NULL
      OR principal_id = private_data.current_principal_id()
    )
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

CREATE POLICY shared_rights_policies_read ON shared_data.rights_policies
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND territory = private_data.current_territory()
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_rights_grants_read ON shared_data.rights_grants
  FOR SELECT TO research_cockpit_runtime
  USING (
    purpose = private_data.current_purpose()
    AND channel = private_data.current_channel()
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_issuers_read ON shared_data.issuers
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_securities_read ON shared_data.securities
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_share_classes_read ON shared_data.share_classes
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_exchanges_read ON shared_data.exchanges
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_listings_read ON shared_data.listings
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_symbol_history_read ON shared_data.symbol_history
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY shared_evidence_read ON shared_data.evidence
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND shared_data.rights_allow_current_use(
      rights_policy_id,
      rights_policy_version
    )
  );

CREATE POLICY shared_financial_facts_read ON shared_data.financial_facts
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND quality_state <> 'quarantined_fixture'
    AND shared_data.rights_allow_current_use(
      rights_policy_id,
      rights_policy_version
    )
  );

CREATE POLICY shared_metric_definitions_read ON shared_data.metric_definitions
  FOR SELECT TO research_cockpit_runtime
  USING (
    classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_entitlement(
      private_data.current_organization_id(),
      'research.synthetic.read'
    )
  );

CREATE POLICY theses_read_current_organization ON private_data.theses
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND data_classification = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

CREATE POLICY theses_insert_editor ON private_data.theses
  FOR INSERT TO research_cockpit_runtime
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND created_by = private_data.current_principal_id()
    AND updated_by = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY theses_update_editor ON private_data.theses
  FOR UPDATE TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  )
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND updated_by = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY alert_rules_read_current_organization ON private_data.alert_rules
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND data_classification = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

CREATE POLICY alert_rules_insert_editor ON private_data.alert_rules
  FOR INSERT TO research_cockpit_runtime
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND created_by = private_data.current_principal_id()
    AND updated_by = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY alert_rules_update_editor ON private_data.alert_rules
  FOR UPDATE TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  )
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND updated_by = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY idempotency_read_own ON private_data.idempotency_records
  FOR SELECT TO research_cockpit_runtime
  USING (
    organization_id = private_data.current_organization_id()
    AND principal_id = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY idempotency_insert_own ON private_data.idempotency_records
  FOR INSERT TO research_cockpit_runtime
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND principal_id = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher']::text[]
    )
  );

CREATE POLICY audit_events_insert_own ON private_data.audit_events
  FOR INSERT TO research_cockpit_runtime
  WITH CHECK (
    organization_id = private_data.current_organization_id()
    AND principal_id = private_data.current_principal_id()
    AND data_classification = 'synthetic'
    AND private_data.current_data_classification() = 'synthetic'
    AND private_data.has_active_membership(
      organization_id,
      ARRAY['owner', 'researcher', 'viewer']::text[]
    )
  );

-- The seed and backup roles are separate NOLOGIN capabilities. They are never
-- granted to another database role by these migrations. All data admitted by
-- this static contract is synthetic; future classifications require new,
-- reviewed policies rather than inheriting these grants.
CREATE POLICY test_seed_organizations ON private_data.organizations
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_principals ON private_data.principals
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_organization_principals
  ON private_data.organization_principals
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_memberships ON private_data.memberships
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_entitlements ON private_data.entitlements
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_theses ON private_data.theses
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_alert_rules ON private_data.alert_rules
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_idempotency_records
  ON private_data.idempotency_records
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');
CREATE POLICY test_seed_audit_events ON private_data.audit_events
  FOR ALL TO research_cockpit_test_seed
  USING (data_classification = 'synthetic')
  WITH CHECK (data_classification = 'synthetic');

CREATE POLICY test_seed_rights_policies ON shared_data.rights_policies
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_rights_grants ON shared_data.rights_grants
  FOR ALL TO research_cockpit_test_seed
  USING (
    EXISTS (
      SELECT 1
      FROM shared_data.rights_policies AS policy
      WHERE policy.policy_id = rights_grants.policy_id
        AND policy.policy_version = rights_grants.policy_version
        AND policy.classification = 'synthetic'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM shared_data.rights_policies AS policy
      WHERE policy.policy_id = rights_grants.policy_id
        AND policy.policy_version = rights_grants.policy_version
        AND policy.classification = 'synthetic'
    )
  );
CREATE POLICY test_seed_issuers ON shared_data.issuers
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_securities ON shared_data.securities
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_share_classes ON shared_data.share_classes
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_exchanges ON shared_data.exchanges
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_listings ON shared_data.listings
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_symbol_history ON shared_data.symbol_history
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_evidence ON shared_data.evidence
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_financial_facts ON shared_data.financial_facts
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');
CREATE POLICY test_seed_metric_definitions ON shared_data.metric_definitions
  FOR ALL TO research_cockpit_test_seed
  USING (classification = 'synthetic')
  WITH CHECK (classification = 'synthetic');

CREATE POLICY backup_read_organizations ON private_data.organizations
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_principals ON private_data.principals
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_organization_principals
  ON private_data.organization_principals
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_memberships ON private_data.memberships
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_entitlements ON private_data.entitlements
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_theses ON private_data.theses
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_alert_rules ON private_data.alert_rules
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_idempotency_records ON private_data.idempotency_records
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');
CREATE POLICY backup_read_audit_events ON private_data.audit_events
  FOR SELECT TO research_cockpit_backup USING (data_classification = 'synthetic');

CREATE POLICY backup_read_rights_policies ON shared_data.rights_policies
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_rights_grants ON shared_data.rights_grants
  FOR SELECT TO research_cockpit_backup
  USING (
    EXISTS (
      SELECT 1
      FROM shared_data.rights_policies AS policy
      WHERE policy.policy_id = rights_grants.policy_id
        AND policy.policy_version = rights_grants.policy_version
        AND policy.classification = 'synthetic'
    )
  );
CREATE POLICY backup_read_issuers ON shared_data.issuers
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_securities ON shared_data.securities
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_share_classes ON shared_data.share_classes
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_exchanges ON shared_data.exchanges
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_listings ON shared_data.listings
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_symbol_history ON shared_data.symbol_history
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_evidence ON shared_data.evidence
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_financial_facts ON shared_data.financial_facts
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');
CREATE POLICY backup_read_metric_definitions ON shared_data.metric_definitions
  FOR SELECT TO research_cockpit_backup USING (classification = 'synthetic');

GRANT SELECT ON private_data.organizations TO research_cockpit_runtime;
GRANT SELECT ON private_data.principals TO research_cockpit_runtime;
GRANT SELECT ON private_data.organization_principals
  TO research_cockpit_runtime;
GRANT SELECT ON private_data.memberships TO research_cockpit_runtime;
GRANT SELECT ON private_data.entitlements TO research_cockpit_runtime;

GRANT SELECT ON shared_data.rights_policies TO research_cockpit_runtime;
GRANT SELECT ON shared_data.rights_grants TO research_cockpit_runtime;
GRANT SELECT ON shared_data.issuers TO research_cockpit_runtime;
GRANT SELECT ON shared_data.securities TO research_cockpit_runtime;
GRANT SELECT ON shared_data.share_classes TO research_cockpit_runtime;
GRANT SELECT ON shared_data.exchanges TO research_cockpit_runtime;
GRANT SELECT ON shared_data.listings TO research_cockpit_runtime;
GRANT SELECT ON shared_data.symbol_history TO research_cockpit_runtime;
GRANT SELECT ON shared_data.evidence TO research_cockpit_runtime;
GRANT SELECT ON shared_data.financial_facts TO research_cockpit_runtime;
GRANT SELECT ON shared_data.metric_definitions TO research_cockpit_runtime;

GRANT SELECT ON private_data.theses TO research_cockpit_runtime;
GRANT SELECT ON private_data.alert_rules TO research_cockpit_runtime;
GRANT SELECT ON private_data.idempotency_records
  TO research_cockpit_runtime;

GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA private_data
  TO research_cockpit_test_seed;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA shared_data
  TO research_cockpit_test_seed;
REVOKE ALL ON TABLE shared_data.schema_migrations
  FROM research_cockpit_test_seed;

GRANT SELECT ON ALL TABLES IN SCHEMA private_data
  TO research_cockpit_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA shared_data
  TO research_cockpit_backup;

REVOKE ALL ON ALL TABLES IN SCHEMA shared_data FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private_data FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA shared_data FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private_data FROM PUBLIC;
