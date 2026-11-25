package lk.ceylonpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "ceylonpay.rate-limit.enabled=false")
@AutoConfigureMockMvc
class AuthRefreshIntegrationTest {

    private static final String PHONE = "+94733333331";

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

    @AfterEach
    void cleanUp() {
        // Refresh tokens are removed by the database (on delete cascade) along with the user.
        new TransactionTemplate(transactionManager).executeWithoutResult(s ->
                userRepository.findByPhone(PHONE).ifPresent(user -> {
                    walletRepository.findByUserId(user.getId()).ifPresent(walletRepository::delete);
                    userRepository.delete(user);
                }));
    }

    private JsonNode register() throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("name", "Refresh T", "phone", PHONE, "nic", "333333331V", "password", "passwordR"));
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private String refreshBody(String token) {
        return "{\"refreshToken\":\"" + token + "\"}";
    }

    @Test
    void refreshingIssuesANewWorkingPairAndRetiresTheOldToken() throws Exception {
        JsonNode session = register();
        String refresh1 = session.get("refreshToken").asText();
        assertThat(refresh1).isNotBlank();

        JsonNode renewed = objectMapper.readTree(mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh1)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String refresh2 = renewed.get("refreshToken").asText();
        assertThat(refresh2).isNotEqualTo(refresh1);

        // The new access token works.
        mockMvc.perform(get("/api/wallet/balance").header("Authorization", "Bearer " + renewed.get("token").asText()))
                .andExpect(status().isOk());
    }

    @Test
    void reusingAnAlreadyUsedTokenKillsTheWholeSession() throws Exception {
        String refresh1 = register().get("refreshToken").asText();
        String refresh2 = objectMapper.readTree(mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh1)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("refreshToken").asText();

        // Someone replays the old token: refused, and the newest token is revoked with it.
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh1)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh2)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheSessionAndUnknownTokensAreRejected() throws Exception {
        String refresh = register().get("refreshToken").asText();

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh)))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody(refresh)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody("not-a-real-token")))
                .andExpect(status().isUnauthorized());
        // Logging out with garbage is harmless.
        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(refreshBody("not-a-real-token")))
                .andExpect(status().isNoContent());
    }

    @Test
    void loginIssuesARefreshTokenToo() throws Exception {
        register();
        JsonNode login = objectMapper.readTree(mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0733333331\",\"password\":\"passwordR\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(login.get("refreshToken").asText()).isNotBlank();
    }

}
