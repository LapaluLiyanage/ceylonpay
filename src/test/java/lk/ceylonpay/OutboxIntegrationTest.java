package lk.ceylonpay;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.repository.OutboxEventRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.service.EventPublisher;
import lk.ceylonpay.service.OutboxPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"ceylonpay.rate-limit.enabled=false", "ceylonpay.otp.enabled=false",
        "outbox.poll-interval-ms=3600000"})
@AutoConfigureMockMvc
@Import(OutboxIntegrationTest.RecordingPublisherConfig.class)
class OutboxIntegrationTest {

    private static final String AGGREGATE = "OutboxTest";
    private static final String PHONE = "+94755555555";
    private static final List<String> delivered = new CopyOnWriteArrayList<>();

    /** Records what it was given and refuses events whose type is "test.fail". */
    @TestConfiguration
    static class RecordingPublisherConfig {
        @Bean
        @Primary
        EventPublisher recordingPublisher() {
            return event -> {
                if ("test.fail".equals(event.getEventType())) {
                    throw new IllegalStateException("receiver is down");
                }
                delivered.add(event.getId());
            };
        }
    }

    @Autowired
    private OutboxPublisher outboxPublisher;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /**
     * Other tests leave unsent events in the shared table. One publishPending() call handles at most 50
     * events, oldest first, so clear them out or these tests could be waiting behind a backlog.
     */
    @BeforeEach
    void clearBacklog() {
        new TransactionTemplate(transactionManager).executeWithoutResult(s ->
                outboxEventRepository.findAll().stream()
                        .filter(e -> !e.isPublished() && !e.isDead())
                        .forEach(e -> {
                            e.setPublished(true);
                            outboxEventRepository.save(e);
                        }));
    }

    @AfterEach
    void cleanUp() {
        delivered.clear();
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            outboxEventRepository.findAll().stream()
                    .filter(e -> AGGREGATE.equals(e.getAggregateType()))
                    .forEach(outboxEventRepository::delete);
            userRepository.findByPhone(PHONE).ifPresent(user -> {
                walletRepository.findByUserId(user.getId()).ifPresent(walletRepository::delete);
                userRepository.delete(user);
            });
        });
    }

    private OutboxEvent save(String type) {
        return outboxEventRepository.save(new OutboxEvent(AGGREGATE, "agg-1", type, "{\"a\":1}"));
    }

    @Test
    void aPendingEventIsDeliveredExactlyOnce() {
        OutboxEvent event = save("test.ok");

        outboxPublisher.publishPending();
        outboxPublisher.publishPending();

        assertThat(delivered).containsOnlyOnce(event.getId());
        OutboxEvent stored = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertThat(stored.isPublished()).isTrue();
        assertThat(stored.getPublishedAt()).isNotNull();
    }

    @Test
    void aFailingEventBacksOffThenIsParkedAndCanBeRequeued() {
        OutboxEvent event = save("test.fail");

        outboxPublisher.publishPending();
        OutboxEvent afterFirst = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertThat(afterFirst.getAttempts()).isEqualTo(1);
        assertThat(afterFirst.isDead()).isFalse();
        assertThat(afterFirst.getLastError()).contains("receiver is down");
        assertThat(afterFirst.getNextAttemptAt()).isAfter(LocalDateTime.now());

        // Still inside the backoff window: not tried again.
        outboxPublisher.publishPending();
        assertThat(outboxEventRepository.findById(event.getId()).orElseThrow().getAttempts()).isEqualTo(1);

        for (int i = 2; i <= OutboxPublisher.MAX_ATTEMPTS; i++) {
            expireBackoff(event.getId());
            outboxPublisher.publishPending();
        }
        OutboxEvent dead = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertThat(dead.isDead()).isTrue();
        assertThat(dead.getAttempts()).isEqualTo(OutboxPublisher.MAX_ATTEMPTS);

        // A parked event is left alone.
        outboxPublisher.publishPending();
        assertThat(outboxEventRepository.findById(event.getId()).orElseThrow().getAttempts())
                .isEqualTo(OutboxPublisher.MAX_ATTEMPTS);

        assertThat(outboxPublisher.requeue(event.getId())).isTrue();
        OutboxEvent requeued = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertThat(requeued.isDead()).isFalse();
        assertThat(requeued.getAttempts()).isZero();
        assertThat(outboxPublisher.requeue(event.getId())).isFalse();
    }

    @Test
    void onlyAdminsSeeAndRequeueDeadEvents() throws Exception {
        OutboxEvent event = save("test.fail");
        for (int i = 1; i <= OutboxPublisher.MAX_ATTEMPTS; i++) {
            expireBackoff(event.getId());
            outboxPublisher.publishPending();
        }

        String userToken = tokenFrom(mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "name", "Outbox T", "phone", "0755555555", "nic", "555555555V", "password", "passwordT"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/admin/outbox").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            var user = userRepository.findByPhone(PHONE).orElseThrow();
            user.setRole("ADMIN");
            userRepository.save(user);
        });
        String adminToken = tokenFrom(mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0755555555\",\"password\":\"passwordT\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/admin/outbox").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dead[?(@.id=='" + event.getId() + "')].lastError").isNotEmpty())
                .andExpect(jsonPath("$.dead[?(@.id=='" + event.getId() + "')].payload").isEmpty());

        mockMvc.perform(post("/api/admin/outbox/" + event.getId() + "/requeue")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/admin/outbox/" + event.getId() + "/requeue")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    private void expireBackoff(String eventId) {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            OutboxEvent e = outboxEventRepository.findById(eventId).orElseThrow();
            e.setNextAttemptAt(null);
            outboxEventRepository.save(e);
        });
    }

    private String tokenFrom(String response) throws Exception {
        return objectMapper.readTree(response).get("token").asText();
    }

}
