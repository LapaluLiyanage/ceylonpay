package lk.ceylonpay.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 4's default JSON stack is Jackson 3 (used transparently by Spring MVC's own
 * converters), so a classic Jackson 2 {@link ObjectMapper} is no longer auto-configured out of
 * the box. TransferService and WalletService need one explicitly to (de)serialize idempotency
 * and outbox event payloads, so it's defined here rather than relied on implicitly.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }

}
