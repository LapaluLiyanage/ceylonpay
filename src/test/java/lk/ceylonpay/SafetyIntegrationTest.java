package lk.ceylonpay;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.repository.SafetySettingsRepository;
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

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"ceylonpay.rate-limit.enabled=false", "ceylonpay.otp.enabled=false"})
@AutoConfigureMockMvc
class SafetyIntegrationTest {

    private static final String SENDER = "+94733333301";
    private static final String RECIPIENT = "+94733333302";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private SafetySettingsRepository safetySettingsRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void cleanUp() {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            for (String phone : new String[] {SENDER, RECIPIENT}) {
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

    @Test
    void nameCheckShowsAShortenedNameAndRejectsUnknownOrInvalidNumbers() throws Exception {
        String token = register("Kasun Perera", SENDER, "333333301V");

        mockMvc.perform(get("/api/users/lookup").param("phone", "0733333301")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("K. Perera"))
                .andExpect(jsonPath("$.phone").value(SENDER));
        mockMvc.perform(get("/api/users/lookup").param("phone", "0733333399")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/users/lookup").param("phone", "123")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/users/lookup").param("phone", "0733333301"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void frozenWalletCannotSendAndDailyLimitIsEnforcedBeforeBalance() throws Exception {
        String token = register("Sender S", SENDER, "333333301V");
        register("Recipient R", RECIPIENT, "333333302V");
        String auth = "Bearer " + token;
        String transfer = "{\"toPhone\":\"" + RECIPIENT + "\",\"amount\":200}";

        mockMvc.perform(put("/api/safety").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"frozen\":true,\"dailyLimit\":null,\"nightLimit\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frozen").value(true));
        mockMvc.perform(post("/api/transfer").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(transfer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("frozen")));

        mockMvc.perform(put("/api/safety").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"frozen\":false,\"dailyLimit\":100,\"nightLimit\":null}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/transfer").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(transfer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("daily limit")));

        mockMvc.perform(get("/api/safety").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyLimit").value(100));
    }

}
