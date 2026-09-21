package lk.ceylonpay.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

/** Enables {@code @Retryable}, used by TransferService to retry a transfer that loses an optimistic-lock race. */
@Configuration
@EnableRetry
public class RetryConfig {
}
