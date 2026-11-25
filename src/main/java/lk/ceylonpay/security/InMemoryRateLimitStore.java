package lk.ceylonpay.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/** Counts in this process's memory. Fine for one instance; with several, each keeps its own count, so use Redis. */
@Component
@ConditionalOnProperty(name = "ceylonpay.rate-limit.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryRateLimitStore implements RateLimitStore {

    private static final class Window {
        final long startMillis;
        final AtomicInteger count = new AtomicInteger(0);

        Window(long startMillis) {
            this.startMillis = startMillis;
        }
    }

    private final AtomicLong lastPruneMillis = new AtomicLong(0);
    private final Map<String, Window> buckets = new ConcurrentHashMap<>();

    @Override
    public long increment(String key, long windowMillis) {
        long now = System.currentTimeMillis();
        Window window = buckets.compute(key, (k, existing) ->
                (existing == null || now - existing.startMillis >= windowMillis) ? new Window(now) : existing);
        long count = window.count.incrementAndGet();
        pruneExpiredIfDue(now, windowMillis);
        return count;
    }

    /** Drops expired windows so the map doesn't grow forever; at most one sweep per window. */
    private void pruneExpiredIfDue(long now, long windowMillis) {
        long last = lastPruneMillis.get();
        if (now - last < windowMillis || !lastPruneMillis.compareAndSet(last, now)) {
            return;
        }
        buckets.values().removeIf(window -> now - window.startMillis >= windowMillis);
    }

}
