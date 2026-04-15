-- RLS policies for all tenant tables
-- Generated from RLS_TABLE_POLICIES in src/rls/policies.ts

-- auth_keys
ALTER TABLE auth_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_keys_account_isolation ON auth_keys;
CREATE POLICY auth_keys_account_isolation ON auth_keys USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_account_isolation ON sessions;
CREATE POLICY sessions_account_isolation ON sessions USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- recovery_keys
ALTER TABLE recovery_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recovery_keys_account_isolation ON recovery_keys;
CREATE POLICY recovery_keys_account_isolation ON recovery_keys USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- device_transfer_requests
ALTER TABLE device_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_transfer_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_transfer_requests_account_isolation ON device_transfer_requests;
CREATE POLICY device_transfer_requests_account_isolation ON device_transfer_requests USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- biometric_tokens
ALTER TABLE biometric_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biometric_tokens_account_isolation ON biometric_tokens;
CREATE POLICY biometric_tokens_account_isolation ON biometric_tokens USING (session_id IN (SELECT id FROM sessions WHERE account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar)) WITH CHECK (session_id IN (SELECT id FROM sessions WHERE account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar));

-- accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_account_isolation ON accounts;
CREATE POLICY accounts_account_isolation ON accounts USING (id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- systems
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS systems_system_isolation ON systems;
CREATE POLICY systems_system_isolation ON systems USING (id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- nomenclature_settings
ALTER TABLE nomenclature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomenclature_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nomenclature_settings_system_isolation ON nomenclature_settings;
CREATE POLICY nomenclature_settings_system_isolation ON nomenclature_settings USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_settings_system_isolation ON system_settings;
CREATE POLICY system_settings_system_isolation ON system_settings USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- innerworld_canvas
ALTER TABLE innerworld_canvas ENABLE ROW LEVEL SECURITY;
ALTER TABLE innerworld_canvas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS innerworld_canvas_system_isolation ON innerworld_canvas;
CREATE POLICY innerworld_canvas_system_isolation ON innerworld_canvas USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_tenant_isolation ON api_keys;
CREATE POLICY api_keys_tenant_isolation ON api_keys USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- device_tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_tokens_tenant_isolation ON device_tokens;
CREATE POLICY device_tokens_tenant_isolation ON device_tokens USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- key_grants
ALTER TABLE key_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_grants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS key_grants_system_isolation ON key_grants;
CREATE POLICY key_grants_system_isolation ON key_grants USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- bucket_content_tags
ALTER TABLE bucket_content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_content_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bucket_content_tags_system_isolation ON bucket_content_tags;
CREATE POLICY bucket_content_tags_system_isolation ON bucket_content_tags USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- friend_bucket_assignments
ALTER TABLE friend_bucket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_bucket_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friend_bucket_assignments_system_isolation ON friend_bucket_assignments;
CREATE POLICY friend_bucket_assignments_system_isolation ON friend_bucket_assignments USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- field_bucket_visibility
ALTER TABLE field_bucket_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_bucket_visibility FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_bucket_visibility_system_isolation ON field_bucket_visibility;
CREATE POLICY field_bucket_visibility_system_isolation ON field_bucket_visibility USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- bucket_key_rotations
ALTER TABLE bucket_key_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_key_rotations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bucket_key_rotations_system_isolation ON bucket_key_rotations;
CREATE POLICY bucket_key_rotations_system_isolation ON bucket_key_rotations USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- bucket_rotation_items
ALTER TABLE bucket_rotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_rotation_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bucket_rotation_items_system_isolation ON bucket_rotation_items;
CREATE POLICY bucket_rotation_items_system_isolation ON bucket_rotation_items USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_system_isolation ON members;
CREATE POLICY members_system_isolation ON members USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- member_photos
ALTER TABLE member_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_photos_system_isolation ON member_photos;
CREATE POLICY member_photos_system_isolation ON member_photos USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- fronting_sessions
ALTER TABLE fronting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fronting_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fronting_sessions_system_isolation ON fronting_sessions;
CREATE POLICY fronting_sessions_system_isolation ON fronting_sessions USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- custom_fronts
ALTER TABLE custom_fronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fronts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_fronts_system_isolation ON custom_fronts;
CREATE POLICY custom_fronts_system_isolation ON custom_fronts USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- fronting_reports
ALTER TABLE fronting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fronting_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fronting_reports_system_isolation ON fronting_reports;
CREATE POLICY fronting_reports_system_isolation ON fronting_reports USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- fronting_comments
ALTER TABLE fronting_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fronting_comments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fronting_comments_system_isolation ON fronting_comments;
CREATE POLICY fronting_comments_system_isolation ON fronting_comments USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_entries_system_isolation ON journal_entries;
CREATE POLICY journal_entries_system_isolation ON journal_entries USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- wiki_pages
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_pages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wiki_pages_system_isolation ON wiki_pages;
CREATE POLICY wiki_pages_system_isolation ON wiki_pages USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channels_system_isolation ON channels;
CREATE POLICY channels_system_isolation ON channels USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_system_isolation ON messages;
CREATE POLICY messages_system_isolation ON messages USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- board_messages
ALTER TABLE board_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS board_messages_system_isolation ON board_messages;
CREATE POLICY board_messages_system_isolation ON board_messages USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_system_isolation ON notes;
CREATE POLICY notes_system_isolation ON notes USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS polls_system_isolation ON polls;
CREATE POLICY polls_system_isolation ON polls USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- poll_votes
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS poll_votes_system_isolation ON poll_votes;
CREATE POLICY poll_votes_system_isolation ON poll_votes USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- acknowledgements
ALTER TABLE acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE acknowledgements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acknowledgements_system_isolation ON acknowledgements;
CREATE POLICY acknowledgements_system_isolation ON acknowledgements USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- buckets
ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE buckets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buckets_system_isolation ON buckets;
CREATE POLICY buckets_system_isolation ON buckets USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- friend_connections
ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_connections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friend_connections_read ON friend_connections;
CREATE POLICY friend_connections_read ON friend_connections FOR SELECT USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar OR friend_account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);
DROP POLICY IF EXISTS friend_connections_write ON friend_connections;
CREATE POLICY friend_connections_write ON friend_connections FOR INSERT WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);
DROP POLICY IF EXISTS friend_connections_update ON friend_connections;
CREATE POLICY friend_connections_update ON friend_connections FOR UPDATE USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);
DROP POLICY IF EXISTS friend_connections_delete ON friend_connections;
CREATE POLICY friend_connections_delete ON friend_connections FOR DELETE USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar OR friend_account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- friend_codes
ALTER TABLE friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friend_codes_account_isolation ON friend_codes;
CREATE POLICY friend_codes_account_isolation ON friend_codes USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS groups_system_isolation ON groups;
CREATE POLICY groups_system_isolation ON groups USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- group_memberships
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_memberships_system_isolation ON group_memberships;
CREATE POLICY group_memberships_system_isolation ON group_memberships USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- innerworld_regions
ALTER TABLE innerworld_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE innerworld_regions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS innerworld_regions_system_isolation ON innerworld_regions;
CREATE POLICY innerworld_regions_system_isolation ON innerworld_regions USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- innerworld_entities
ALTER TABLE innerworld_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE innerworld_entities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS innerworld_entities_system_isolation ON innerworld_entities;
CREATE POLICY innerworld_entities_system_isolation ON innerworld_entities USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- relationships
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS relationships_system_isolation ON relationships;
CREATE POLICY relationships_system_isolation ON relationships USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_structure_entity_types
ALTER TABLE system_structure_entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_structure_entity_types FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_structure_entity_types_system_isolation ON system_structure_entity_types;
CREATE POLICY system_structure_entity_types_system_isolation ON system_structure_entity_types USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_structure_entities
ALTER TABLE system_structure_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_structure_entities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_structure_entities_system_isolation ON system_structure_entities;
CREATE POLICY system_structure_entities_system_isolation ON system_structure_entities USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_structure_entity_links
ALTER TABLE system_structure_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_structure_entity_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_structure_entity_links_system_isolation ON system_structure_entity_links;
CREATE POLICY system_structure_entity_links_system_isolation ON system_structure_entity_links USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_structure_entity_member_links
ALTER TABLE system_structure_entity_member_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_structure_entity_member_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_structure_entity_member_links_system_isolation ON system_structure_entity_member_links;
CREATE POLICY system_structure_entity_member_links_system_isolation ON system_structure_entity_member_links USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- system_structure_entity_associations
ALTER TABLE system_structure_entity_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_structure_entity_associations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_structure_entity_associations_system_isolation ON system_structure_entity_associations;
CREATE POLICY system_structure_entity_associations_system_isolation ON system_structure_entity_associations USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- field_definitions
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_definitions_system_isolation ON field_definitions;
CREATE POLICY field_definitions_system_isolation ON field_definitions USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- field_definition_scopes
ALTER TABLE field_definition_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_definition_scopes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_definition_scopes_system_isolation ON field_definition_scopes;
CREATE POLICY field_definition_scopes_system_isolation ON field_definition_scopes USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- field_values
ALTER TABLE field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_values FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_values_system_isolation ON field_values;
CREATE POLICY field_values_system_isolation ON field_values USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- lifecycle_events
ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lifecycle_events_system_isolation ON lifecycle_events;
CREATE POLICY lifecycle_events_system_isolation ON lifecycle_events USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- safe_mode_content
ALTER TABLE safe_mode_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_mode_content FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS safe_mode_content_system_isolation ON safe_mode_content;
CREATE POLICY safe_mode_content_system_isolation ON safe_mode_content USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- pk_bridge_configs
ALTER TABLE pk_bridge_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pk_bridge_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pk_bridge_configs_system_isolation ON pk_bridge_configs;
CREATE POLICY pk_bridge_configs_system_isolation ON pk_bridge_configs USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- notification_configs
ALTER TABLE notification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_configs_system_isolation ON notification_configs;
CREATE POLICY notification_configs_system_isolation ON notification_configs USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- friend_notification_preferences
ALTER TABLE friend_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_notification_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friend_notification_preferences_account_isolation ON friend_notification_preferences;
CREATE POLICY friend_notification_preferences_account_isolation ON friend_notification_preferences USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- system_snapshots
ALTER TABLE system_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_snapshots_system_isolation ON system_snapshots;
CREATE POLICY system_snapshots_system_isolation ON system_snapshots USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- webhook_configs
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_configs_system_isolation ON webhook_configs;
CREATE POLICY webhook_configs_system_isolation ON webhook_configs USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- webhook_deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_deliveries_system_isolation ON webhook_deliveries;
CREATE POLICY webhook_deliveries_system_isolation ON webhook_deliveries USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- blob_metadata
ALTER TABLE blob_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE blob_metadata FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blob_metadata_system_isolation ON blob_metadata;
CREATE POLICY blob_metadata_system_isolation ON blob_metadata USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- timer_configs
ALTER TABLE timer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timer_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timer_configs_system_isolation ON timer_configs;
CREATE POLICY timer_configs_system_isolation ON timer_configs USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- check_in_records
ALTER TABLE check_in_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS check_in_records_system_isolation ON check_in_records;
CREATE POLICY check_in_records_system_isolation ON check_in_records USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- import_jobs
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_jobs_tenant_isolation ON import_jobs;
CREATE POLICY import_jobs_tenant_isolation ON import_jobs USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- import_entity_refs
ALTER TABLE import_entity_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_entity_refs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_entity_refs_tenant_isolation ON import_entity_refs;
CREATE POLICY import_entity_refs_tenant_isolation ON import_entity_refs USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- export_requests
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS export_requests_tenant_isolation ON export_requests;
CREATE POLICY export_requests_tenant_isolation ON export_requests USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar AND system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- account_purge_requests
ALTER TABLE account_purge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_purge_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_purge_requests_account_isolation ON account_purge_requests;
CREATE POLICY account_purge_requests_account_isolation ON account_purge_requests USING (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar) WITH CHECK (account_id = NULLIF(current_setting('app.current_account_id', true), '')::varchar);

-- search_index
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS search_index_system_isolation ON search_index;
CREATE POLICY search_index_system_isolation ON search_index USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- sync_documents
ALTER TABLE sync_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_documents_system_isolation ON sync_documents;
CREATE POLICY sync_documents_system_isolation ON sync_documents USING (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar) WITH CHECK (system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar);

-- sync_changes
ALTER TABLE sync_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_changes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_changes_system_isolation ON sync_changes;
CREATE POLICY sync_changes_system_isolation ON sync_changes USING (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)) WITH CHECK (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar));

-- sync_snapshots
ALTER TABLE sync_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_snapshots_system_isolation ON sync_snapshots;
CREATE POLICY sync_snapshots_system_isolation ON sync_snapshots USING (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)) WITH CHECK (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar));

-- sync_conflicts
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_conflicts_system_isolation ON sync_conflicts;
CREATE POLICY sync_conflicts_system_isolation ON sync_conflicts USING (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar)) WITH CHECK (document_id IN (SELECT document_id FROM sync_documents WHERE system_id = NULLIF(current_setting('app.current_system_id', true), '')::varchar));

