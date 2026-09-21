package lk.ceylonpay.service;

import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Polls the outbox table and delivers pending events at-least-once.
 *
 * <p>In production this would push to a message broker (Kafka, SQS, a
 * webhook) so other services — notifications, analytics, a fraud engine —
 * learn about a completed transfer without CeylonPay calling them
 * synchronously inside the transfer request. Here delivery is simulated
 * with a log line so the pattern is demonstrable without extra
 * infrastructure; swapping the {@code deliver} method for a real publisher
 * call is the only change needed to make this production-real.</p>
 */
@Service
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int MAX_ATTEMPTS = 5;

    private final OutboxEventRepository outboxEventRepository;

    public OutboxPublisher(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Scheduled(fixedDelayString = "${outbox.poll-interval-ms:5000}")
    @Transactional
    public void publishPending() {
        List<OutboxEvent> pending = outboxEventRepository.findTop50ByPublishedFalseOrderByCreatedAtAsc();
        for (OutboxEvent event : pending) {
            try {
                deliver(event);
                event.setPublished(true);
                event.setPublishedAt(LocalDateTime.now());
            } catch (Exception e) {
                event.setAttempts(event.getAttempts() + 1);
                log.warn("Outbox event {} delivery failed (attempt {}/{}): {}",
                        event.getId(), event.getAttempts(), MAX_ATTEMPTS, e.getMessage());
            }
            outboxEventRepository.save(event);
        }
    }

    private void deliver(OutboxEvent event) {
        // Simulated delivery target. Replace with a real message broker / webhook client.
        log.info("Publishing outbox event [{}] {} for {}#{}: {}",
                event.getId(), event.getEventType(), event.getAggregateType(), event.getAggregateId(), event.getPayload());
    }

}
