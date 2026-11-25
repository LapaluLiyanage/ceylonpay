package lk.ceylonpay;

import lk.ceylonpay.security.RateLimitStore;
import lk.ceylonpay.security.RedisRateLimitStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** The app starts with the Redis store selected (Redis itself is only contacted when a request is counted). */
@SpringBootTest(properties = {"ceylonpay.rate-limit.store=redis", "ceylonpay.otp.enabled=false"})
class RedisStoreWiringTest {

    @Autowired
    private RateLimitStore store;

    @Test
    void redisStoreIsUsedWhenConfigured() {
        assertThat(store).isInstanceOf(RedisRateLimitStore.class);
    }

}
