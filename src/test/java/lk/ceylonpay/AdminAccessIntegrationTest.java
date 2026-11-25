package lk.ceylonpay;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "ceylonpay.rate-limit.enabled=false")
@AutoConfigureMockMvc
class AdminAccessIntegrationTest {

    private static final String PHONE = "+94744444444";

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
        new TransactionTemplate(transactionManager).executeWithoutResult(s ->
                userRepository.findByPhone(PHONE).ifPresent(user -> {
                    walletRepository.findByUserId(user.getId()).ifPresent(walletRepository::delete);
                    userRepository.delete(user);
                }));
    }

    private String body(String phone) throws Exception {
        return objectMapper.writeValueAsString(
                java.util.Map.of("name", "Admin T", "phone", phone, "nic", "444444444V", "password", "passwordT"));
    }

    private String tokenFrom(String response) throws Exception {
        return objectMapper.readTree(response).get("token").asText();
    }

    @Test
    void regularUsersAreForbiddenFromAdminEndpointsButAdminsAreNot() throws Exception {
        String userToken = tokenFrom(mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body("0744444444")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/admin/reconciliation").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/mules").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/reconciliation"))
                .andExpect(status().isUnauthorized());

        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            var user = userRepository.findByPhone(PHONE).orElseThrow();
            user.setRole("ADMIN");
            userRepository.save(user);
        });

        String adminToken = tokenFrom(mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0744444444\",\"password\":\"passwordT\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/admin/reconciliation").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/mules").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void sameNumberInTwoFormatsCannotRegisterTwice() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body("0744444444")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("+94744444444").replace("444444444V", "444444445V")))
                .andExpect(status().isBadRequest());
    }

}
