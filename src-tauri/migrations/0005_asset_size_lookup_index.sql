CREATE INDEX indexed_files_project_size_idx
    ON indexed_files(project_id, size_bytes, status);
