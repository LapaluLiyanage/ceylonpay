package lk.ceylonpay.dto;

import lk.ceylonpay.entity.OutboxEvent;

import java.time.LocalDateTime;

/** An outbox event as an admin sees it. The payload is left out on purpose: it can hold personal data. */
public record OutboxEventResponse(
        String id,
        String eventType,
        String aggregateType,
        String aggregateId,
        int attempts,
        String lastError,
        LocalDateTime createdAt
) {
    public static OutboxEventResponse from(OutboxEvent event) {
        return new OutboxEventResponse(event.getId(), event.getEventType(), event.getAggregateType(),
                event.getAggregateId(), event.getAttempts(), event.getLastError(), event.getCreatedAt());
    }
}
