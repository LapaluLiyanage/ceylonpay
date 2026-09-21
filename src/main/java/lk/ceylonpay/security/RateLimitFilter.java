package lk.ceylonpay.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Fixed-window rate limiter for the endpoints an attacker or a buggy client
 * would hammer: login/register (credential stuffing, account enumeration)
 * and transfer (automated draining). This is the in-memory equivalent of
 * what a production deployment would run against Redis so limits hold
 * across multiple instances — swapping the {@code ConcurrentHashMap} below
 * for a Redis-backed counter is a drop-in change; the request-handling
 * logic doesn't need to change.
 *
 * <p>Deliberately implemented as a plain servlet filter (not a Spring MVC
 * interceptor) so it runs before Spring Security's authentication filter —
 * a client that's already being rate-limited never even reaches JWT
 * validation.</p>
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000; // 1 minute

    /** Requests allowed per client, per path, per window. */
    private static final Map<String, Integer> LIMITS = Map.of(
            "/api/auth/login", 10,
            "/api/auth/register", 5,
            "/api/transfer", 30
    );

    private final AtomicLong lastPruneMillis = new AtomicLong(0);
    private final Map<String, Window> buckets = new ConcurrentHashMap<>();

    private static final class Window {
        final long startMillis;
        final AtomicInteger count;

        Window(long startMillis) {
            this.startMillis = startMillis;
            this.count = new AtomicInteger(0);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !LIMITS.containsKey(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        int limit = LIMITS.get(path);
        String bucketKey = path + '|' + clientKey(request);
        long now = System.currentTimeMillis();

        Window window = buckets.compute(bucketKey, (key, existing) ->
                (existing == null || now - existing.startMillis >= WINDOW_MILLIS) ? new Window(now) : existing);
        int currentCount = window.count.incrementAndGet();
        pruneExpiredIfDue(now);

        if (currentCount > limit) {
            response.setStatus(429); // 429 Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests. Please try again in a minute.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** Prefers the original client IP behind a proxy/load balancer (Render, most PaaS hosts) over the proxy's own IP. */
    private String clientKey(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Sweeps out windows that have already expired, so {@code buckets} doesn't grow forever
     * as new client IPs show up. Runs at most once per {@code WINDOW_MILLIS}, gated by a CAS
     * on {@code lastPruneMillis} so only one request pays for the sweep at a time.
     */
    private void pruneExpiredIfDue(long now) {
        long last = lastPruneMillis.get();
        if (now - last < WINDOW_MILLIS || !lastPruneMillis.compareAndSet(last, now)) {
            return;
        }
        buckets.values().removeIf(window -> now - window.startMillis >= WINDOW_MILLIS);
    }

}
