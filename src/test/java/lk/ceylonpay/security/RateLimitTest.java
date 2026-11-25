package lk.ceylonpay.security;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitTest {

    @Test
    void inMemoryStoreCountsPerKeyAndRestartsAfterTheWindow() throws Exception {
        InMemoryRateLimitStore store = new InMemoryRateLimitStore();

        assertThat(store.increment("a", 60_000)).isEqualTo(1);
        assertThat(store.increment("a", 60_000)).isEqualTo(2);
        assertThat(store.increment("b", 60_000)).isEqualTo(1);

        assertThat(store.increment("short", 20)).isEqualTo(1);
        Thread.sleep(40);
        assertThat(store.increment("short", 20)).isEqualTo(1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void redisStoreReturnsTheCountAndLetsRequestsThroughWhenRedisIsDown() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        RedisRateLimitStore store = new RedisRateLimitStore(redis);

        when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(7L);
        assertThat(store.increment("k", 60_000)).isEqualTo(7);

        when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class)))
                .thenThrow(new IllegalStateException("connection refused"));
        assertThat(store.increment("k", 60_000)).isZero();
    }

    @Test
    void filterAnswers429OnceTheLimitIsPassedAndKeysByPathAndClient() throws Exception {
        List<String> keys = new java.util.ArrayList<>();
        long[] count = {0};
        RateLimitStore store = (key, window) -> {
            keys.add(key);
            return ++count[0];
        };
        RateLimitFilter filter = new RateLimitFilter(store);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/account/phone/request");
        request.setRequestURI("/api/account/phone/request");
        request.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.1");

        for (int i = 1; i <= 3; i++) {
            MockHttpServletResponse ok = new MockHttpServletResponse();
            filter.doFilter(request, ok, new MockFilterChain());
            assertThat(ok.getStatus()).isEqualTo(200);
        }
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(request, blocked, new MockFilterChain());

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(keys).allMatch("/api/account/phone/request|203.0.113.9"::equals);

        MockHttpServletRequest other = new MockHttpServletRequest("GET", "/api/wallet");
        other.setRequestURI("/api/wallet");
        MockHttpServletResponse untouched = new MockHttpServletResponse();
        int before = keys.size();
        filter.doFilter(other, untouched, new MockFilterChain());
        assertThat(keys).hasSize(before);
    }

}
