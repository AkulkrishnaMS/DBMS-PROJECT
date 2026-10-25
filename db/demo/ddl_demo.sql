-- ALTER / DROP demonstration (run manually, not part of init)
ALTER TABLE users    ADD COLUMN country VARCHAR(2);
ALTER TABLE users    ADD CONSTRAINT chk_country CHECK (country ~ '^[A-Z]{2}$');
ALTER TABLE problems ADD COLUMN tags TEXT[] DEFAULT '{}';
CREATE INDEX idx_problems_tags ON problems USING GIN (tags);
DROP INDEX idx_problems_tags;
ALTER TABLE problems DROP COLUMN tags;
ALTER TABLE users    DROP CONSTRAINT chk_country;
ALTER TABLE users    DROP COLUMN country;
