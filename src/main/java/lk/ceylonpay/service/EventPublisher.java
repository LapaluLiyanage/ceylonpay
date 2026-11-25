package lk.ceylonpay.service;

import lk.ceylonpay.entity.OutboxEvent;

/**
 * Hands one outbox event to the outside world. It must throw if the event was not accepted, so the
 * outbox retries it. Delivery is at-least-once, so receivers should de-duplicate on the event id.
 *
 * <p>Pick the implementation with {@code ceylonpay.events.sink}: {@code log} (default, development
 * only) or {@code webhook}. A Kafka, SQS or RabbitMQ publisher is one more class implementing this
 * interface; nothing else in the app changes.</p>
 */
public interface EventPublisher {

    void publish(OutboxEvent event) throws Exception;

}
