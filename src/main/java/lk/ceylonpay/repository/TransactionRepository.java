package lk.ceylonpay.repository;

import lk.ceylonpay.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(String senderWalletId, String receiverWalletId);

    /** Total a wallet has sent since the given moment (used for the user's own daily limit). */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t "
            + "where t.sender.id = :walletId and t.createdAt >= :since and t.status = 'SUCCESS'")
    BigDecimal sumSentSince(@Param("walletId") String walletId, @Param("since") LocalDateTime since);

}
