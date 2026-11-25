package lk.ceylonpay.repository;

import lk.ceylonpay.entity.OtpChallenge;
import lk.ceylonpay.entity.OtpPurpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, String> {

    /** The newest code sent to this user for this purpose that has not been used. */
    Optional<OtpChallenge> findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(String userId,
                                                                                            OtpPurpose purpose);

    Optional<OtpChallenge> findFirstByUserIdAndPurposeOrderByCreatedAtDesc(String userId, OtpPurpose purpose);

    @Modifying
    @Query("update OtpChallenge c set c.attempts = c.attempts + 1 where c.id = :id")
    int incrementAttempts(@Param("id") String id);

}
