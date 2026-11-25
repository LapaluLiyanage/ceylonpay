package lk.ceylonpay.service;

import lk.ceylonpay.entity.RefreshToken;
import lk.ceylonpay.exception.InvalidCredentialsException;
import lk.ceylonpay.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * Long-lived sign-in that can be taken away. The short-lived access token is what authorizes
 * requests; this opaque token only buys a new pair.
 *
 * <p>Tokens rotate: every use invalidates the presented token and issues the next one in the same
 * family. If a token that was already used turns up again, someone has a copy they should not
 * have, so the entire family (that login session) is revoked.</p>
 */
@Service
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;
    private final long lifetimeDays;

    public RefreshTokenService(RefreshTokenRepository repository,
                               @Value("${jwt.refresh-expiration-days:30}") long lifetimeDays) {
        this.repository = repository;
        this.lifetimeDays = lifetimeDays;
    }

    /** The raw token for a new login session. Shown to the client once; only its hash is kept. */
    @Transactional
    public String startSession(String userId) {
        return issue(userId, UUID.randomUUID().toString());
    }

    /** Result of a successful rotation: who it belongs to, and the replacement token. */
    public record Rotation(String userId, String newRefreshToken) {
    }

    /**
     * Consumes the presented token and returns its replacement. {@code noRollbackFor} matters: when
     * reuse is detected the family revocation must commit even though this method then throws.
     */
    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public Rotation rotate(String rawToken) {
        LocalDateTime now = LocalDateTime.now();
        RefreshToken token = repository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new InvalidCredentialsException("Invalid refresh token"));

        if (token.getRevokedAt() != null) {
            repository.revokeFamily(token.getFamilyId(), now);
            throw new InvalidCredentialsException("Invalid refresh token");
        }
        if (token.getExpiresAt().isBefore(now)) {
            throw new InvalidCredentialsException("Refresh token expired");
        }

        token.setRevokedAt(now);
        repository.save(token);
        return new Rotation(token.getUserId(), issue(token.getUserId(), token.getFamilyId()));
    }

    /** Ends the login session this token belongs to. Unknown tokens are ignored: logout always succeeds. */
    @Transactional
    public void revokeSession(String rawToken) {
        repository.findByTokenHash(hash(rawToken))
                .ifPresent(token -> repository.revokeFamily(token.getFamilyId(), LocalDateTime.now()));
    }

    private String issue(String userId, String familyId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        repository.save(new RefreshToken(userId, hash(raw), familyId, LocalDateTime.now().plusDays(lifetimeDays)));
        return raw;
    }

    static String hash(String raw) {
        return IdempotencyService.hash(raw);
    }

}
