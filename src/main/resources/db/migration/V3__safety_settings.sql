-- Per-user safety controls: self-freeze and the user's own spending limits.
create table safety_settings (
    user_id varchar(255) primary key references users (id),
    frozen boolean not null default false,
    daily_limit numeric(19,4),
    night_limit numeric(19,4),
    updated_at timestamp(6) not null
);
