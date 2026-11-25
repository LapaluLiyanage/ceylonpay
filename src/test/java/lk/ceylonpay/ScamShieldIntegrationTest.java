package lk.ceylonpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.LedgerEntryRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end: warn then confirm, hold then cancel, hold then approve. */
@SpringBootTest(properties = {"ceylonpay.rate-limit.enabled=false", "ceylonpay.otp.enabled=false"})
@AutoConfigureMockMvc
class ScamShieldIntegrationTest {

    private static final String SENDER = "+94733333311";
    private static final String RECEIVER = "+94733333312";
    private static final String ADMIN = "+94733333313";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void cleanUp() {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Set<String> walletIds = new java.util.HashSet<>();
            for (String phone : List.of(SENDER, RECEIVER, ADMIN)) {
                userRepository.findByPhone(phone).flatMap(u -> walletRepository.findByUserId(u.getId()))
                        .ifPresent(w -> walletIds.add(w.getId()));
            }
            for (Transaction t : transactionRepository.findAll()) {
                if (walletIds.contains(t.getSender().getId()) || walletIds.contains(t.getReceiver().getId())) {
                    ledgerEntryRepository.deleteByTransaction_Id(t.getId());
                    auditLogRepository.findByTransaction_Id(t.getId()).ifPresent(auditLogRepository::delete);
                    transactionRepository.delete(t);
                }
            }
            for (String phone : List.of(SENDER, RECEIVER, ADMIN)) {
                userRepository.findByPhone(phone).ifPresent(user -> {
                    walletRepository.findByUserId(user.getId()).ifPresent(walletRepository::delete);
                    userRepository.delete(user);
                });
            }
        });
    }

    private String register(String name, String phone, String nic) throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", name, "phone", phone, "nic", nic, "password", "passwordS"));
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private void setBalance(String phone, String balance) {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Wallet w = walletRepository.findByUserId(userRepository.findByPhone(phone).orElseThrow().getId()).orElseThrow();
            w.setBalance(new BigDecimal(balance));
            walletRepository.save(w);
        });
    }

    private BigDecimal balanceOf(String phone) {
        return walletRepository.findByUserId(userRepository.findByPhone(phone).orElseThrow().getId())
                .orElseThrow().getBalance();
    }

    private String send(String token, String amount, boolean ack, int expectedStatus) throws Exception {
        return mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":" + amount + ",\"acknowledgeRisk\":" + ack + "}"))
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void firstPaymentToANewAccountWarnsAndGoesThroughOnlyAfterConfirmation() throws Exception {
        String token = register("Sender S", SENDER, "333333311V");
        register("Receiver R", RECEIVER, "333333312V");
        setBalance(SENDER, "10000");

        mockMvc.perform(post("/api/transfer/risk-check").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("WARN"))
                .andExpect(jsonPath("$.reasons[0].code").value("FIRST_PAYMENT"));

        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.outcome").value("WARN"))
                .andExpect(jsonPath("$.error", containsString("risky")));
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("10000");

        send(token, "100", true, 200);
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9900");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("100");
    }

    @Test
    void highRiskTransferIsHeldWithoutMovingMoneyThenCancelledOrApproved() throws Exception {
        String token = register("Sender S", SENDER, "333333311V");
        register("Receiver R", RECEIVER, "333333312V");
        register("Admin A", ADMIN, "333333313V");
        setBalance(SENDER, "10000");

        // Build a history of small payments so a large one stands out (first needs the confirmation).
        send(token, "100", true, 200);
        send(token, "100", false, 200);
        send(token, "100", false, 200);
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9700");

        // Large, near-everything, to a brand new account, after rapid payments: held.
        JsonNode held = objectMapper.readTree(send(token, "9000", false, 200));
        assertThat(held.get("status").asText()).isEqualTo("PENDING_REVIEW");
        assertThat(held.get("reasons")).isNotEmpty();
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9700");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("300");

        // The sender sees it as pending; the receiver does not see it at all.
        String receiverToken = loginToken(RECEIVER);
        mockMvc.perform(get("/api/transactions").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("PENDING_REVIEW"));
        mockMvc.perform(get("/api/transactions").header("Authorization", "Bearer " + receiverToken))
                .andExpect(jsonPath("$.length()").value(3));

        // Only the sender can cancel it, and then it is gone from the queue.
        String heldId = held.get("transactionId").asText();
        mockMvc.perform(post("/api/transfer/" + heldId + "/cancel").header("Authorization", "Bearer " + receiverToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/transfer/" + heldId + "/cancel").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9700");

        // Held again, this time a reviewer approves it.
        String heldAgain = objectMapper.readTree(send(token, "9000", false, 200)).get("transactionId").asText();
        mockMvc.perform(get("/api/admin/reviews").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());

        promoteToAdmin();
        String adminToken = loginToken(ADMIN);
        mockMvc.perform(get("/api/admin/reviews").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + heldAgain + "')].amount").isNotEmpty());
        mockMvc.perform(post("/api/admin/reviews/" + heldAgain + "/approve").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("700");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("9300");

        // A transfer can only be released once.
        mockMvc.perform(post("/api/admin/reviews/" + heldAgain + "/approve").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    private void promoteToAdmin() {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            var admin = userRepository.findByPhone(ADMIN).orElseThrow();
            admin.setRole("ADMIN");
            userRepository.save(admin);
        });
    }

    private String loginToken(String phone) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"password\":\"passwordS\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

}
