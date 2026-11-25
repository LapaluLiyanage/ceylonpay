package lk.ceylonpay.service;

import lk.ceylonpay.entity.OutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Development sink: writes the event to the log and goes nowhere else. */
@Component
@ConditionalOnProperty(name = "ceylonpay.events.sink", havingValue = "log", matchIfMissing = true)
public class LoggingEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(LoggingEventPublisher.class);

    @Override
    public void publish(OutboxEvent event) {
        log.info("Publishing outbox event [{}] {} for {}#{}: {}",
                event.getId(), event.getEventType(), event.getAggregateType(), event.getAggregateId(), event.getPayload());
    }

}
