package lk.ceylonpay.service;

import lk.ceylonpay.repository.OtpChallengeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counts a wrong guess in its own transaction. A wrong code usually makes the caller (for example a
 * transfer) roll back, and the count must survive that, or guessing would be free.
 */
@Service
public class OtpAttemptRecorder {

    private final OtpChallengeRepository repository;

    public OtpAttemptRecorder(OtpChallengeRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String challengeId) {
        repository.incrementAttempts(challengeId);
    }

}
