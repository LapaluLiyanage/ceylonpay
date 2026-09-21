package lk.ceylonpay.service;

import lk.ceylonpay.entity.IdempotencyKey;
import lk.ceylonpay.entity.IdempotencyStatus;
import lk.ceylonpay.exception.IdempotencyConflictException;
import lk.ceylonpay.repository.IdempotencyKeyRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Makes write endpoints safe to retry.
 *
 * <p>A mobile client on a flaky connection may send the exact same
 * "transfer Rs. 500" request twice — once that genuinely times out with no
 * response, and once as an automatic retry. Without this, that's two
 * transfers. With it, the client sends a unique {@code Idempotency-Key}
 * header it generates once per user action; CeylonPay processes the first
 * occurrence and replays the cached result for every subsequent one,
 * regardless of how many times the network makes the client retry.</p>
 */
@Service
public class IdempotencyService {

    private final IdempotencyKeyRepository repository;

    public IdempotencyService(IdempotencyKeyRepository repository) {
        this.repository = repository;
    }

    public static String hash(String requestBody) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(requestBody.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /**
     * Call before doing the real work. Returns the cached response if this
     * key has already completed, or empty if this is a genuinely new
     * request that the caller should now go and process.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<IdempotencyKey> begin(String key, String userId, String requestHash) {
        Optional<IdempotencyKey> existing = repository.findById(key);
        if (existing.isPresent()) {
            IdempotencyKey found = existing.get();
            if (!found.getRequestHash().equals(requestHash)) {
                throw new IdempotencyConflictException(
                        "Idempotency-Key '" + key + "' was already used with a different request");
            }
            return found.getStatus() == IdempotencyStatus.IN_PROGRESS ? Optional.of(found) : existing;
        }

        try {
            repository.save(new IdempotencyKey(key, userId, requestHash));
        } catch (DataIntegrityViolationException raceLost) {
            // Another concurrent request with the same key won the insert race; treat it the same as "already exists".
            return repository.findById(key);
        }
        return Optional.empty();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(String key, int httpStatus, String responseBodyJson) {
        repository.findById(key).ifPresent(record -> {
            record.setStatus(IdempotencyStatus.COMPLETED);
            record.setResponseStatus(httpStatus);
            record.setResponseBody(responseBodyJson);
            repository.save(record);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String key) {
        repository.findById(key).ifPresent(record -> {
            record.setStatus(IdempotencyStatus.FAILED);
            repository.save(record);
        });
    }

}
