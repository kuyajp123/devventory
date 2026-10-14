-- Retire large snapshots incrementally without an unbounded cascading delete.
ALTER TABLE snapshots ADD COLUMN retiring INTEGER NOT NULL DEFAULT 0 CHECK(retiring IN(0,1));
