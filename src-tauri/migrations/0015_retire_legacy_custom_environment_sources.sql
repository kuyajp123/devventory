-- Credential Vault owns the records copied by migration 14. Retire the legacy
-- write model so deleted vault credentials cannot leave stale tracker metadata.
DROP TABLE custom_environment_keys;
DROP TABLE custom_environment_sources;
