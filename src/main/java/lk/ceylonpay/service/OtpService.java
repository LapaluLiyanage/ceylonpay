package lk.ceylonpay.service;

import lk.ceylonpay.dto.OtpSentResponse;
import lk.ceylonpay.entity.OtpChallenge;
import lk.ceylonpay.entity.OtpPurpose;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.exception.InvalidOtpException;
import lk.ceylonpay.exception.OtpRequiredException;
import lk.ceylonpay.exception.TransferBlockedException;
import lk.ceylonpay.repository.OtpChallengeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * One-time codes sent by SMS. Used to prove phone ownership at registration and to add a second
 * confirmation to a risky transfer.
 *
 * <p>A code lasts 5 minutes, allows 5 wrong guesses, can be requested at most once every 30 seconds,
 * is stored only as a hash, and (for a transfer) works only for the recipient and amount it was issued for.</p>
 */
@Service
public class OtpService {

    static final int MAX_ATTEMPTS = 5;
    static final Duration LIFETIME = Duration.ofMinutes(5);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpChallengeRepository repository;
    private final OtpAttemptRecorder attemptRecorder;
    private final SmsSender smsSender;
    private final boolean enabled;
    private final boolean devCodeInResponse;

    public OtpService(OtpChallengeRepository repository, OtpAttemptRecorder attemptRecorder, SmsSender smsSender,
                      @Value("${ceylonpay.otp.enabled:true}") boolean enabled,
                      @Value("${ceylonpay.sms.dev-code-in-response:false}") boolean devCodeInResponse) {
        this.repository = repository;
        this.attemptRecorder = attemptRecorder;
        this.smsSender = smsSender;
        this.enabled = enabled;
        this.devCodeInResponse = devCodeInResponse;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** Context that ties a transfer code to one recipient and amount. */
    public static String transferContext(String toPhone, BigDecimal amount) {
        return toPhone + "|" + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /** New accounts must prove their phone before they can send money. */
    public void requireVerifiedPhone(User user) {
        if (enabled && !user.isPhoneVerified()) {
            throw new TransferBlockedException("Verify your phone number to send money.");
        }
    }

    @Transactional
    public OtpSentResponse send(User user, OtpPurpose purpose, String context) {
        if (!enabled) {
            return new OtpSentResponse(false, null);
        }
        LocalDateTime now = LocalDateTime.now();
        repository.findFirstByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), purpose)
                .filter(last -> last.getCreatedAt().plus(RESEND_COOLDOWN).isAfter(now))
                .ifPresent(last -> {
                    throw new InvalidOtpException("Please wait a few seconds before asking for another code.");
                });

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        repository.save(new OtpChallenge(user.getId(), purpose, context == null ? null : hash(context),
                hash(user.getId() + ":" + purpose + ":" + code), now.plus(LIFETIME)));
        smsSender.send(user.getPhone(), "Your CeylonPay code is " + code
                + ". Never share it with anyone. CeylonPay staff will never ask for it.");
        return new OtpSentResponse(true, devCodeInResponse ? code : null);
    }

    /**
     * Checks a code and uses it up. Wrong guesses are counted in their own transaction so the count
     * survives the caller rolling back.
     */
    @Transactional
    public void verify(User user, OtpPurpose purpose, String code, String context) {
        if (!enabled) {
            return;
        }
        if (code == null || code.isBlank()) {
            throw new OtpRequiredException();
        }
        OtpChallenge challenge = repository
                .findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(user.getId(), purpose)
                .orElseThrow(() -> new InvalidOtpException("Request a new code first."));

        if (challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new InvalidOtpException("This code has expired. Request a new one.");
        }
        if (challenge.getAttempts() >= MAX_ATTEMPTS) {
            throw new InvalidOtpException("Too many wrong attempts. Request a new code.");
        }
        if (context != null && !constantTimeEquals(challenge.getContextHash(), hash(context))) {
            throw new InvalidOtpException("This code was issued for a different transfer. Request a new one.");
        }
        if (!constantTimeEquals(challenge.getCodeHash(), hash(user.getId() + ":" + purpose + ":" + code))) {
            attemptRecorder.recordFailure(challenge.getId());
            throw new InvalidOtpException("That code is not correct.");
        }

        challenge.setConsumedAt(LocalDateTime.now());
        repository.save(challenge);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String hash(String value) {
        return IdempotencyService.hash(value);
    }

}
