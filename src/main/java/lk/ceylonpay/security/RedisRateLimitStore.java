package lk.ceylonpay.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Counts in Redis, so the limit holds across every app instance. Select with
 * {@code ceylonpay.rate-limit.store=redis} and point {@code spring.data.redis.url} at the server.
 *
 * <p>If Redis cannot be reached the request is let through (and logged). Rate limiting is a
 * safeguard, and a Redis outage should not stop people paying.</p>
 */
@Component
@ConditionalOnProperty(name = "ceylonpay.rate-limit.store", havingValue = "redis")
public class RedisRateLimitStore implements RateLimitStore {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimitStore.class);

    /** Count up and start the window's expiry on the first hit, in one atomic step. */
    private static final DefaultRedisScript<Long> INCREMENT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
            return count
            """, Long.class);

    private final StringRedisTemplate redis;

    public RedisRateLimitStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public long increment(String key, long windowMillis) {
        try {
            Long count = redis.execute(INCREMENT, List.of("ceylonpay:rl:" + key), String.valueOf(windowMillis));
            return count == null ? 0 : count;
        } catch (RuntimeException e) {
            log.error("Rate limit store unreachable, letting the request through: {}", e.getMessage());
            return 0;
        }
    }

}
