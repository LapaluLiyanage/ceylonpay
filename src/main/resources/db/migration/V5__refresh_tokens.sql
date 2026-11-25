-- Rotating refresh tokens. Only a hash of each token is stored; a login session is a "family" of
-- tokens, and reusing an already-used token revokes the whole family.
create table refresh_tokens (
    id varchar(255) primary key,
    user_id varchar(255) not null references users (id) on delete cascade,
    token_hash varchar(64) not null unique,
    family_id varchar(255) not null,
    expires_at timestamp(6) not null,
    revoked_at timestamp(6),
    created_at timestamp(6) not null
);

create index idx_refresh_tokens_family on refresh_tokens (family_id);
create index idx_refresh_tokens_user on refresh_tokens (user_id);
