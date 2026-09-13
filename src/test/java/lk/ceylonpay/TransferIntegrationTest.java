package lk.ceylonpay;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TransferIntegrationTest {

    private static final String SENDER_PHONE = "0755555555";
    private static final String RECIPIENT_PHONE = "0766666666";

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

    @AfterEach
    void cleanUpTestUsers() {
        userRepository.findByPhone(SENDER_PHONE).ifPresent(sender -> {
            walletRepository.findByUserId(sender.getId()).ifPresent(wallet -> {
                transactionRepository.findAll().stream()
                        .filter(t -> t.getSender().getId().equals(wallet.getId())
                                || t.getReceiver().getId().equals(wallet.getId()))
                        .forEach(t -> {
                            auditLogRepository.findAll().stream()
                                    .filter(a -> a.getTransaction().getId().equals(t.getId()))
                                    .forEach(auditLogRepository::delete);
                            transactionRepository.delete(t);
                        });
                walletRepository.delete(wallet);
            });
            userRepository.delete(sender);
        });
        userRepository.findByPhone(RECIPIENT_PHONE).ifPresent(recipient -> {
            walletRepository.findByUserId(recipient.getId()).ifPresent(walletRepository::delete);
            userRepository.delete(recipient);
        });
    }

    private String register(String name, String phone, String nic, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new RegisterPayload(name, phone, nic, password));
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    @Test
    void transferMovesRealMoneyBetweenRealWalletsThroughTheFullStack() throws Exception {
        String senderToken = register("Sender E", SENDER_PHONE, "555555555V", "passwordE");
        register("Recipient F", RECIPIENT_PHONE, "666666666V", "passwordF");

        mockMvc.perform(post("/api/wallet/deposit")
                        .header("Authorization", "Bearer " + senderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 500}"))
                .andExpect(status().isOk());

        String transferResponse = mockMvc.perform(post("/api/transfer")
                        .header("Authorization", "Bearer " + senderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toPhone\": \"" + RECIPIENT_PHONE + "\", \"amount\": 200}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode json = objectMapper.readTree(transferResponse);
        assertThat(json.get("newBalance").decimalValue()).isEqualByComparingTo("300.0000");

        var senderUser = userRepository.findByPhone(SENDER_PHONE).orElseThrow();
        var recipientUser = userRepository.findByPhone(RECIPIENT_PHONE).orElseThrow();
        var senderWallet = walletRepository.findByUserId(senderUser.getId()).orElseThrow();
        var recipientWallet = walletRepository.findByUserId(recipientUser.getId()).orElseThrow();

        assertThat(senderWallet.getBalance()).isEqualByComparingTo("300.0000");
        assertThat(recipientWallet.getBalance()).isEqualByComparingTo("200.0000");
    }

    private record RegisterPayload(String name, String phone, String nic, String password) {
    }

}
