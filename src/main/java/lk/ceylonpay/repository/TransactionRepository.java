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

    long countBySender_IdAndReceiver_IdAndStatus(String senderWalletId, String receiverWalletId, String status);

    long countBySender_IdAndStatus(String senderWalletId, String status);

    long countBySender_IdAndCreatedAtAfter(String senderWalletId, LocalDateTime since);

    List<Transaction> findByStatusOrderByCreatedAtAsc(String status);

    /** Average size of a wallet's completed payments; null when it has none. */
    @Query("select avg(t.amount) from Transaction t where t.sender.id = :walletId and t.status = 'SUCCESS'")
    Double averageSentAmount(@Param("walletId") String walletId);

    /** How many different people paid this wallet since the given moment (deposits from the system account excluded). */
    @Query("select count(distinct t.sender.id) from Transaction t where t.receiver.id = :walletId "
            + "and t.createdAt >= :since and t.status = 'SUCCESS' and t.sender.user.role <> 'SYSTEM'")
    long countDistinctSendersSince(@Param("walletId") String walletId, @Param("since") LocalDateTime since);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.receiver.id = :walletId "
            + "and t.createdAt >= :since and t.status = 'SUCCESS' and t.sender.user.role <> 'SYSTEM'")
    BigDecimal sumReceivedFromUsersSince(@Param("walletId") String walletId, @Param("since") LocalDateTime since);

    /** Total a wallet has sent since the given moment (used for the user's own daily limit). */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t "
            + "where t.sender.id = :walletId and t.createdAt >= :since and t.status = 'SUCCESS'")
    BigDecimal sumSentSince(@Param("walletId") String walletId, @Param("since") LocalDateTime since);

}
