package lk.ceylonpay.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import lk.ceylonpay.entity.OutboxEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebhookEventPublisherTest {

    private static final String SECRET = "shared-secret";

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>();
    private final AtomicReference<com.sun.net.httpserver.Headers> headers = new AtomicReference<>();

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/events", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            headers.set(exchange.getRequestHeaders());
            exchange.sendResponseHeaders(status.get(), -1);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private WebhookEventPublisher publisher(String secret) {
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/events";
        return new WebhookEventPublisher(mapper, url, secret, 2000);
    }

    private OutboxEvent event() {
        OutboxEvent event = new OutboxEvent("Transaction", "txn-1", "transfer.completed", "{\"amount\":500}");
        event.setId("evt-1");
        return event;
    }

    @Test
    void postsASignedEnvelopeTheReceiverCanVerify() throws Exception {
        publisher(SECRET).publish(event());

        JsonNode sent = mapper.readTree(body.get());
        assertThat(sent.get("id").asText()).isEqualTo("evt-1");
        assertThat(sent.get("type").asText()).isEqualTo("transfer.completed");
        assertThat(sent.get("aggregateId").asText()).isEqualTo("txn-1");
        assertThat(sent.get("data").get("amount").asInt()).isEqualTo(500);

        assertThat(headers.get().getFirst("X-CeylonPay-Event-Id")).isEqualTo("evt-1");
        String timestamp = headers.get().getFirst("X-CeylonPay-Timestamp");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + body.get()).getBytes(StandardCharsets.UTF_8)));
        assertThat(headers.get().getFirst("X-CeylonPay-Signature")).isEqualTo(expected);
    }

    @Test
    void aNon2xxAnswerCountsAsAFailureSoTheOutboxRetries() {
        status.set(503);

        assertThatThrownBy(() -> publisher(SECRET).publish(event()))
                .hasMessageContaining("503");
    }

    @Test
    void refusesToStartWithoutAUrlAndSecret() {
        assertThatThrownBy(() -> new WebhookEventPublisher(mapper, "", SECRET, 1000))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> publisher(""))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new WebhookEventPublisher(mapper, "ftp://example.com", SECRET, 1000))
                .isInstanceOf(IllegalStateException.class);
    }

}
