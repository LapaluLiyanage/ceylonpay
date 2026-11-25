package lk.ceylonpay.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.ceylonpay.entity.OutboxEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Posts each event as JSON to a URL you control (a notification service, an analytics collector, an
 * API gateway in front of a queue). Every request is signed so the receiver can tell it came from
 * CeylonPay:
 *
 * <pre>X-CeylonPay-Signature: hex(HMAC-SHA256(secret, timestamp + "." + body))</pre>
 *
 * <p>The receiver should reject old timestamps and ignore an {@code X-CeylonPay-Event-Id} it has
 * already seen, because delivery is at-least-once.</p>
 */
@Component
@ConditionalOnProperty(name = "ceylonpay.events.sink", havingValue = "webhook")
public class WebhookEventPublisher implements EventPublisher {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI url;
    private final byte[] secret;
    private final Duration timeout;

    public WebhookEventPublisher(ObjectMapper objectMapper,
                                 @Value("${ceylonpay.events.webhook.url:}") String url,
                                 @Value("${ceylonpay.events.webhook.secret:}") String secret,
                                 @Value("${ceylonpay.events.webhook.timeout-ms:5000}") long timeoutMs) {
        if (url.isBlank() || secret.isBlank()) {
            throw new IllegalStateException(
                    "ceylonpay.events.sink=webhook needs ceylonpay.events.webhook.url and ceylonpay.events.webhook.secret");
        }
        URI parsed = URI.create(url.trim());
        if (!"https".equalsIgnoreCase(parsed.getScheme()) && !"http".equalsIgnoreCase(parsed.getScheme())) {
            throw new IllegalStateException("ceylonpay.events.webhook.url must be an http(s) URL");
        }
        this.objectMapper = objectMapper;
        this.url = parsed;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.timeout = Duration.ofMillis(timeoutMs);
        this.httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
    }

    @Override
    public void publish(OutboxEvent event) throws Exception {
        String body = envelope(event);
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);

        HttpRequest request = HttpRequest.newBuilder(url)
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("X-CeylonPay-Event-Id", event.getId())
                .header("X-CeylonPay-Event-Type", event.getEventType())
                .header("X-CeylonPay-Timestamp", timestamp)
                .header("X-CeylonPay-Signature", sign(timestamp + "." + body))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("Webhook answered HTTP " + response.statusCode());
        }
    }

    private String envelope(OutboxEvent event) throws JsonProcessingException {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", event.getId());
        node.put("type", event.getEventType());
        node.put("aggregateType", event.getAggregateType());
        node.put("aggregateId", event.getAggregateId());
        node.put("createdAt", String.valueOf(event.getCreatedAt()));
        node.set("data", parseOrText(event.getPayload()));
        return objectMapper.writeValueAsString(node);
    }

    private JsonNode parseOrText(String payload) {
        try {
            return objectMapper.readTree(payload);
        } catch (JsonProcessingException e) {
            return objectMapper.getNodeFactory().textNode(payload);
        }
    }

    private String sign(String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

}
