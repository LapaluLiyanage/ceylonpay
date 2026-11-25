package lk.ceylonpay.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * Fixed-window rate limiter for the endpoints an attacker or a buggy client
 * would hammer: login/register (credential stuffing, account enumeration)
 * and transfer (automated draining). Counting is delegated to a {@link RateLimitStore}:
 * in memory by default, or Redis ({@code ceylonpay.rate-limit.store=redis}) so the
 * limits hold across several app instances.
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
            "/api/auth/refresh", 30,
            "/api/account/phone/request", 3,
            "/api/account/phone/verify", 10,
            "/api/transfer/otp", 5,
            "/api/transfer", 30,
            "/api/transfer/risk-check", 60,
            "/api/users/lookup", 30
    );

    /** Turned off only by integration tests, which register many users from one client address. */
    @Value("${ceylonpay.rate-limit.enabled:true}")
    private boolean enabled = true;

    private final RateLimitStore store;

    public RateLimitFilter(RateLimitStore store) {
        this.store = store;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !LIMITS.containsKey(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        int limit = LIMITS.get(path);
        String bucketKey = path + '|' + clientKey(request);

        if (store.increment(bucketKey, WINDOW_MILLIS) > limit) {
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

}
