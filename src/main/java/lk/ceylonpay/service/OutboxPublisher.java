package lk.ceylonpay.service;

import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Polls the outbox table and hands pending events to the {@link EventPublisher} at-least-once.
 *
 * <p>Each event is delivered in its own short transaction while its row is locked, so several app
 * instances can run this at the same time without sending an event twice, and a slow receiver only
 * holds one row. A failed event backs off (10 s, 20 s, 40 s ... up to 10 min) and after
 * {@value #MAX_ATTEMPTS} failures it is parked as dead for an admin to look at and requeue.</p>
 */
@Service
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);

    public static final int MAX_ATTEMPTS = 5;
    private static final int BATCH = 50;
    private static final Duration BASE_BACKOFF = Duration.ofSeconds(10);
    private static final Duration MAX_BACKOFF = Duration.ofMinutes(10);

    private final OutboxEventRepository outboxEventRepository;
    private final EventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;

    public OutboxPublisher(OutboxEventRepository outboxEventRepository, EventPublisher eventPublisher,
                           PlatformTransactionManager transactionManager) {
        this.outboxEventRepository = outboxEventRepository;
        this.eventPublisher = eventPublisher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${outbox.poll-interval-ms:5000}")
    public void publishPending() {
        for (int i = 0; i < BATCH; i++) {
            Boolean handled = transactionTemplate.execute(status -> deliverNext());
            if (!Boolean.TRUE.equals(handled)) {
                return;
            }
        }
    }

    /** Delivers the oldest due event. Returns false when nothing is waiting. */
    private boolean deliverNext() {
        Optional<OutboxEvent> next = outboxEventRepository.lockDue(LocalDateTime.now(), PageRequest.of(0, 1))
                .stream().findFirst();
        if (next.isEmpty()) {
            return false;
        }
        OutboxEvent event = next.get();
        try {
            eventPublisher.publish(event);
            event.setPublished(true);
            event.setPublishedAt(LocalDateTime.now());
            event.setLastError(null);
        } catch (Exception e) {
            recordFailure(event, e);
        }
        outboxEventRepository.save(event);
        return true;
    }

    private void recordFailure(OutboxEvent event, Exception e) {
        int attempts = event.getAttempts() + 1;
        event.setAttempts(attempts);
        event.setLastError(truncate(e.getClass().getSimpleName() + ": " + e.getMessage()));
        if (attempts >= MAX_ATTEMPTS) {
            event.setDead(true);
            log.error("Outbox event {} ({}) gave up after {} attempts: {}",
                    event.getId(), event.getEventType(), attempts, event.getLastError());
        } else {
            event.setNextAttemptAt(LocalDateTime.now().plus(backoff(attempts)));
            log.warn("Outbox event {} delivery failed (attempt {}/{}): {}",
                    event.getId(), attempts, MAX_ATTEMPTS, event.getLastError());
        }
    }

    static Duration backoff(int attempts) {
        long seconds = BASE_BACKOFF.toSeconds() << Math.min(attempts - 1, 10);
        return Duration.ofSeconds(Math.min(seconds, MAX_BACKOFF.toSeconds()));
    }

    private static String truncate(String text) {
        return text.length() <= 500 ? text : text.substring(0, 500);
    }

    @Transactional(readOnly = true)
    public List<OutboxEvent> deadEvents() {
        return outboxEventRepository.findByDeadTrueOrderByCreatedAtAsc();
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return outboxEventRepository.countByPublishedFalseAndDeadFalse();
    }

    /** Puts a dead event back in the queue with a fresh set of attempts. */
    @Transactional
    public boolean requeue(String eventId) {
        return outboxEventRepository.findById(eventId)
                .filter(OutboxEvent::isDead)
                .map(event -> {
                    event.setDead(false);
                    event.setAttempts(0);
                    event.setNextAttemptAt(null);
                    outboxEventRepository.save(event);
                    return true;
                })
                .orElse(false);
    }

}
