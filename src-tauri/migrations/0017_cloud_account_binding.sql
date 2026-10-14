-- Account/workspace association only. Secrets remain in the native credential store.
ALTER TABLE cloud_sync_config ADD COLUMN owner_uid TEXT;
CREATE TABLE cloud_sync_device_registrations (
  firebase_uid TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL UNIQUE
);
