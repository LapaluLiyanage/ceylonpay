-- Delivery bookkeeping for the outbox: an event that keeps failing is parked (dead) instead of
-- being retried forever, and retries back off instead of hammering the receiver.
alter table outbox_events add column dead boolean not null default false;
alter table outbox_events add column last_error varchar(500);
alter table outbox_events add column next_attempt_at timestamp(6);

create index idx_outbox_due on outbox_events (created_at) where published = false and dead = false;
