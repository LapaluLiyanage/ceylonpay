-- Baseline schema (generated from the JPA entities as they stood before Flyway was introduced).
-- Databases that already exist are baselined at this version and skip it; fresh databases run it.

create table audit_log (
    created_at timestamp(6) not null,
    detail varchar(255) not null,
    id varchar(255) not null,
    transaction_id varchar(255) not null unique,
    primary key (id)
);

create table idempotency_keys (
    response_status integer,
    created_at timestamp(6) not null,
    updated_at timestamp(6) not null,
    version bigint not null,
    status varchar(20) not null check ((status in ('IN_PROGRESS','COMPLETED','FAILED'))),
    id varchar(128) not null,
    request_hash varchar(255) not null,
    user_id varchar(255) not null,
    response_body oid,
    primary key (id)
);

create table ledger_entries (
    amount numeric(19,4) not null,
    balance_after numeric(19,4) not null,
    created_at timestamp(6) not null,
    entry_type varchar(10) not null check ((entry_type in ('DEBIT','CREDIT'))),
    id varchar(255) not null,
    transaction_id varchar(255) not null,
    wallet_id varchar(255) not null,
    primary key (id)
);

create table outbox_events (
    attempts integer not null,
    published boolean not null,
    created_at timestamp(6) not null,
    published_at timestamp(6),
    aggregate_type varchar(50) not null,
    event_type varchar(100) not null,
    aggregate_id varchar(255) not null,
    id varchar(255) not null,
    payload oid not null,
    primary key (id)
);

create table reconciliation_discrepancies (
    cached_balance numeric(19,4) not null,
    ledger_balance numeric(19,4) not null,
    resolved boolean not null,
    detected_at timestamp(6) not null,
    id varchar(255) not null,
    wallet_id varchar(255) not null,
    primary key (id)
);

create table transactions (
    amount numeric(19,4) not null,
    created_at timestamp(6) not null,
    id varchar(255) not null,
    receiver_wallet_id varchar(255) not null,
    sender_wallet_id varchar(255) not null,
    status varchar(255) not null,
    primary key (id)
);

create table users (
    created_at timestamp(6) not null,
    id varchar(255) not null,
    name varchar(255) not null,
    nic varchar(255) not null unique,
    password varchar(255) not null,
    phone varchar(255) not null unique,
    role varchar(255) not null,
    primary key (id)
);

create table wallets (
    balance numeric(19,4) not null,
    updated_at timestamp(6) not null,
    version bigint not null,
    id varchar(255) not null,
    user_id varchar(255) not null unique,
    primary key (id)
);

create index idx_ledger_wallet 
   on ledger_entries (wallet_id);

create index idx_ledger_transaction 
   on ledger_entries (transaction_id);

alter table audit_log 
   add constraint FKtrg4nbhy1qbsvswxwdfkuma1u 
   foreign key (transaction_id) 
   references transactions;

alter table ledger_entries 
   add constraint FKgwcsld4m3g325l66qro45i14x 
   foreign key (transaction_id) 
   references transactions;

alter table ledger_entries 
   add constraint FKcfwn04lfp5eyco3vbjc3729ib 
   foreign key (wallet_id) 
   references wallets;

alter table transactions 
   add constraint FK5tr9f7tf144wrpoomtqyguilu 
   foreign key (receiver_wallet_id) 
   references wallets;

alter table transactions 
   add constraint FKe0ppnh35227iut4l5u6bgghyw 
   foreign key (sender_wallet_id) 
   references wallets;

alter table wallets 
   add constraint FKc1foyisidw7wqqrkamafuwn4e 
   foreign key (user_id) 
   references users;
