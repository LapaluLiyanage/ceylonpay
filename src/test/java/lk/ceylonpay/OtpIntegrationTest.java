package lk.ceylonpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.LedgerEntryRepository;
import lk.ceylonpay.repository.SafetySettingsRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** One-time codes switched on (the other integration tests switch them off). */
@SpringBootTest(properties = {"ceylonpay.rate-limit.enabled=false", "ceylonpay.sms.dev-code-in-response=true"})
@AutoConfigureMockMvc
class OtpIntegrationTest {

    private static final String SENDER = "+94733333341";
    private static final String RECEIVER = "+94733333342";
    private static final List<String> PHONES = List.of(SENDER, RECEIVER);

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
    private SafetySettingsRepository safetySettingsRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private javax.sql.DataSource dataSource;

    @AfterEach
    void cleanUp() {
        // otp_challenges and refresh_tokens go with the user (on delete cascade).
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Set<String> walletIds = new HashSet<>();
            for (String phone : PHONES) {
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
            for (String phone : PHONES) {
                userRepository.findByPhone(phone).ifPresent(user -> {
                    safetySettingsRepository.deleteById(user.getId());
                    walletRepository.findByUserId(user.getId()).ifPresent(walletRepository::delete);
                    userRepository.delete(user);
                });
            }
        });
    }

    private JsonNode register(String name, String phone, String nic) throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", name, "phone", phone, "nic", nic, "password", "passwordO"));
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private String requestPhoneCode(String token) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/account/phone/request")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("devCode").asText();
    }

    private void verifyPhone(String token, String code, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/account/phone/verify").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().is(expectedStatus));
    }

    private void setBalance(String phone, String balance) {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Wallet w = walletRepository.findByUserId(userRepository.findByPhone(phone).orElseThrow().getId()).orElseThrow();
            w.setBalance(new BigDecimal(balance));
            walletRepository.save(w);
        });
    }

    @Test
    void anUnverifiedPhoneCannotSendMoneyUntilTheCodeIsEntered() throws Exception {
        JsonNode session = register("Sender O", SENDER, "333333341V");
        String token = session.get("token").asText();
        assertThat(session.get("phoneVerified").asBoolean()).isFalse();
        register("Receiver O", RECEIVER, "333333342V");

        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("Verify your phone")));

        // Asking again straight away is refused (resend cooldown); the registration code is still valid.
        mockMvc.perform(post("/api/account/phone/request").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // A wrong guess is refused; asking for a fresh code (after the cooldown) and entering it works.
        verifyPhone(token, "000000", 400);
        String code = requestAndReadCode(token);
        verifyPhone(token, code, 204);
        verifyPhone(token, code, 400); // a code works once

        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isBadRequest()); // now it reaches the balance check: verification no longer blocks it
    }

    private String loginToken(String phone) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"password\":\"passwordO\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void aWarnedTransferNeedsACodeThatIsBoundToThatRecipientAndAmount() throws Exception {
        String token = register("Sender O", SENDER, "333333341V").get("token").asText();
        String receiverToken = register("Receiver O", RECEIVER, "333333342V").get("token").asText();
        // Verify both phones.
        verifyPhone(token, requestAndReadCode(token), 204);
        verifyPhone(receiverToken, requestAndReadCode(receiverToken), 204);
        setBalance(SENDER, "10000");

        String ackTransfer = "{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100,\"acknowledgeRisk\":true}";

        // Acknowledging the warning is not enough: a code is required.
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(ackTransfer))
                .andExpect(status().is(428))
                .andExpect(jsonPath("$.code").value("OTP_REQUIRED"));

        String code = objectMapper.readTree(mockMvc.perform(post("/api/transfer/otp").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("devCode").asText();

        // A different amount cannot use this code.
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":900,\"acknowledgeRisk\":true,\"otpCode\":\"" + code + "\"}"))
                .andExpect(status().isBadRequest());
        // A wrong code is refused.
        String wrong = code.equals("111111") ? "222222" : "111111";
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100,\"acknowledgeRisk\":true,\"otpCode\":\"" + wrong + "\"}"))
                .andExpect(status().isBadRequest());
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("10000");

        // The right code for the right transfer works, once.
        String good = "{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100,\"acknowledgeRisk\":true,\"otpCode\":\"" + code + "\"}";
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(good))
                .andExpect(status().isOk());
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9900");
    }

    private BigDecimal balanceOf(String phone) {
        return walletRepository.findByUserId(userRepository.findByPhone(phone).orElseThrow().getId())
                .orElseThrow().getBalance();
    }

    /** Requests a code, first moving this test's earlier codes out of the 30-second resend cooldown. */
    private String requestAndReadCode(String token) throws Exception {
        new org.springframework.jdbc.core.JdbcTemplate(dataSource).update(
                "update otp_challenges set created_at = created_at - interval '1 minute' "
                        + "where user_id in (select id from users where phone in (?, ?))", SENDER, RECEIVER);
        return requestPhoneCode(token);
    }

}
