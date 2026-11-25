package lk.ceylonpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.LedgerEntryRepository;
import lk.ceylonpay.repository.SafetySettingsRepository;
import lk.ceylonpay.repository.ScamReportRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Report a scam, freeze the receiver, then recover (fully or partly) or dismiss. */
@SpringBootTest(properties = {"ceylonpay.rate-limit.enabled=false", "ceylonpay.otp.enabled=false"})
@AutoConfigureMockMvc
class ScamRecoveryIntegrationTest {

    private static final String SENDER = "+94733333321";
    private static final String RECEIVER = "+94733333322";
    private static final String ADMIN = "+94733333323";
    private static final List<String> PHONES = List.of(SENDER, RECEIVER, ADMIN);

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
    private ScamReportRepository scamReportRepository;

    @Autowired
    private SafetySettingsRepository safetySettingsRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private String senderToken;
    private String receiverToken;
    private String adminToken;
    private String transferId;

    @BeforeEach
    void setUp() throws Exception {
        senderToken = register("Sender S", SENDER, "333333321V");
        receiverToken = register("Receiver R", RECEIVER, "333333322V");
        register("Admin A", ADMIN, "333333323V");
        setBalance(SENDER, "10000");
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            var admin = userRepository.findByPhone(ADMIN).orElseThrow();
            admin.setRole("ADMIN");
            userRepository.save(admin);
        });
        adminToken = login(ADMIN);

        // Rs. 500 to a brand-new account: a warning the sender accepts.
        String response = mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + senderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":500,\"acknowledgeRisk\":true}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        transferId = objectMapper.readTree(response).get("transactionId").asText();
    }

    @AfterEach
    void cleanUp() {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Set<String> walletIds = new HashSet<>();
            for (String phone : PHONES) {
                userRepository.findByPhone(phone).flatMap(u -> walletRepository.findByUserId(u.getId()))
                        .ifPresent(w -> walletIds.add(w.getId()));
            }
            for (Transaction t : transactionRepository.findAll()) {
                if (walletIds.contains(t.getSender().getId()) || walletIds.contains(t.getReceiver().getId())) {
                    scamReportRepository.findByTransaction_Id(t.getId()).ifPresent(scamReportRepository::delete);
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

    private String register(String name, String phone, String nic) throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", name, "phone", phone, "nic", nic, "password", "passwordS"));
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String login(String phone) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"password\":\"passwordS\"}"))
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

    private String report() throws Exception {
        String response = mockMvc.perform(post("/api/transfer/" + transferId + "/report")
                        .header("Authorization", "Bearer " + senderToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"fake job offer\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private JsonNode resolve(String reportId, String decision) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/admin/reports/" + reportId + "/resolve")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void reportFreezesTheReceiverAndUpholdingItPullsTheFullAmountBack() throws Exception {
        // Only the sender can report their own transfer.
        mockMvc.perform(post("/api/transfer/" + transferId + "/report").header("Authorization", "Bearer " + receiverToken))
                .andExpect(status().isNotFound());

        String reportId = report();
        mockMvc.perform(post("/api/transfer/" + transferId + "/report").header("Authorization", "Bearer " + senderToken))
                .andExpect(status().isBadRequest());

        // The receiver can no longer move money out, and cannot lift the hold themselves.
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + receiverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + SENDER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("under review")));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/safety")
                        .header("Authorization", "Bearer " + receiverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"frozen\":false,\"dailyLimit\":null,\"nightLimit\":null}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + receiverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + SENDER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isForbidden());

        // Ordinary users cannot see the queue; admins can.
        mockMvc.perform(get("/api/admin/reports").header("Authorization", "Bearer " + senderToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/reports").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + reportId + "')].note").value("fake job offer"));

        JsonNode resolved = resolve(reportId, "UPHOLD");
        assertThat(resolved.get("status").asText()).isEqualTo("UPHELD");
        assertThat(resolved.get("recoveredAmount").decimalValue()).isEqualByComparingTo("500");
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("10000");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("0");

        // Both sides see it in their history: the original is marked reversed, plus the refund.
        mockMvc.perform(get("/api/transactions").header("Authorization", "Bearer " + senderToken))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.status=='REVERSED')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.status=='REVERSAL')]").isNotEmpty());

        // The hold is lifted (now it fails on balance, not on review), and the account is flagged for others.
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + receiverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + SENDER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/transfer/risk-check").header("Authorization", "Bearer " + senderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + RECEIVER + "\",\"amount\":100}"))
                .andExpect(jsonPath("$.reasons[?(@.code=='REPORTED_SCAM')]").isNotEmpty());

        // A report can be resolved only once.
        mockMvc.perform(post("/api/admin/reports/" + reportId + "/resolve").header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"UPHOLD\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upholdingRecoversOnlyWhatTheReceiverStillHas() throws Exception {
        setBalance(RECEIVER, "200"); // they already spent the rest
        String reportId = report();

        JsonNode resolved = resolve(reportId, "UPHOLD");

        assertThat(resolved.get("recoveredAmount").decimalValue()).isEqualByComparingTo("200");
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9700");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("0");
    }

    @Test
    void dismissingLiftsTheHoldAndMovesNoMoney() throws Exception {
        String reportId = report();

        JsonNode resolved = resolve(reportId, "DISMISS");

        assertThat(resolved.get("status").asText()).isEqualTo("DISMISSED");
        assertThat(balanceOf(SENDER)).isEqualByComparingTo("9500");
        assertThat(balanceOf(RECEIVER)).isEqualByComparingTo("500");
        mockMvc.perform(post("/api/transfer").header("Authorization", "Bearer " + receiverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\":\"" + SENDER + "\",\"amount\":100,\"acknowledgeRisk\":true}"))
                .andExpect(status().isOk());
    }

}
