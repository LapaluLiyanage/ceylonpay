-- Phone verification and one-time codes. Accounts that already exist are treated as verified,
-- so turning this on does not lock anyone out.
alter table users add column phone_verified boolean not null default false;
update users set phone_verified = true;

create table otp_challenges (
    id varchar(255) primary key,
    user_id varchar(255) not null references users (id) on delete cascade,
    purpose varchar(20) not null,
    context_hash varchar(64),
    code_hash varchar(64) not null,
    attempts integer not null default 0,
    expires_at timestamp(6) not null,
    consumed_at timestamp(6),
    created_at timestamp(6) not null
);

create index idx_otp_user_purpose on otp_challenges (user_id, purpose);
