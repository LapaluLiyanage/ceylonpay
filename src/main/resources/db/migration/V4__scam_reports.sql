-- "This was a scam" reports, and a system-set hold on the reported receiver's outgoing money.
alter table safety_settings add column review_hold boolean not null default false;

create table scam_reports (
    id varchar(255) primary key,
    transaction_id varchar(255) not null unique references transactions (id),
    reporter_user_id varchar(255) not null,
    note varchar(500),
    status varchar(20) not null,
    recovered_amount numeric(19,4),
    created_at timestamp(6) not null,
    resolved_at timestamp(6),
    resolved_by varchar(255)
);
