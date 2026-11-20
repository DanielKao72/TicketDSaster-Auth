-- PA-05 (UsernamePolicy): usernames are unique regardless of case, so
-- 'Venue1' and 'venue1' cannot both register. The column keeps the case as
-- registered; this index enforces uniqueness on its lowercase form and backs
-- the case-insensitive lookup in PostgresUserRepository.findByUsername.
-- It fails if the table already holds usernames that differ only in case.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
