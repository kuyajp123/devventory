ALTER TABLE indexed_files
    ADD COLUMN managed INTEGER NOT NULL DEFAULT 0 CHECK (managed IN (0, 1));
ALTER TABLE indexed_files
    ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1));
ALTER TABLE indexed_files
    ADD COLUMN content_hash TEXT CHECK (
        content_hash IS NULL OR (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*')
    );
ALTER TABLE indexed_files
    ADD COLUMN hashed_size_bytes INTEGER CHECK (hashed_size_bytes IS NULL OR hashed_size_bytes >= 0);
ALTER TABLE indexed_files
    ADD COLUMN hashed_modified_at_ms INTEGER;

CREATE TABLE asset_tags (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 40),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, normalized_name),
    UNIQUE(id, project_id)
);

CREATE TABLE file_tags (
    indexed_file_id TEXT NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES asset_tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY(indexed_file_id, tag_id)
);

CREATE TABLE file_notes (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    indexed_file_id TEXT NOT NULL UNIQUE REFERENCES indexed_files(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 10000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE asset_relations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    primary_file_id TEXT NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
    variant_file_id TEXT NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'variant' CHECK (relation_type = 'variant'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (primary_file_id <> variant_file_id),
    UNIQUE(project_id, primary_file_id, variant_file_id)
);

CREATE TRIGGER file_tags_same_project_insert
BEFORE INSERT ON file_tags
FOR EACH ROW
WHEN (
    SELECT project_id FROM indexed_files WHERE id = NEW.indexed_file_id
) <> (
    SELECT project_id FROM asset_tags WHERE id = NEW.tag_id
)
BEGIN
    SELECT RAISE(ABORT, 'asset tag project mismatch');
END;

CREATE TRIGGER asset_relations_same_project_insert
BEFORE INSERT ON asset_relations
FOR EACH ROW
WHEN NEW.project_id <> (
    SELECT project_id FROM indexed_files WHERE id = NEW.primary_file_id
) OR NEW.project_id <> (
    SELECT project_id FROM indexed_files WHERE id = NEW.variant_file_id
)
BEGIN
    SELECT RAISE(ABORT, 'asset relation project mismatch');
END;

CREATE INDEX indexed_files_asset_filters_idx
    ON indexed_files(project_id, managed, is_favorite, status, relative_path);
CREATE INDEX indexed_files_content_hash_idx
    ON indexed_files(project_id, size_bytes, content_hash)
    WHERE content_hash IS NOT NULL;
CREATE INDEX indexed_files_project_size_idx
    ON indexed_files(project_id, size_bytes, status);
CREATE INDEX asset_tags_project_name_idx
    ON asset_tags(project_id, normalized_name);
CREATE INDEX file_tags_tag_idx
    ON file_tags(tag_id, indexed_file_id);
CREATE INDEX asset_relations_primary_idx
    ON asset_relations(project_id, primary_file_id);
CREATE INDEX asset_relations_variant_idx
    ON asset_relations(project_id, variant_file_id);
