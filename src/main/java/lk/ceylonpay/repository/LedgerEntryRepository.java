package lk.ceylonpay.repository;

import lk.ceylonpay.entity.LedgerEntry;
import lk.ceylonpay.entity.LedgerEntryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, String> {

    List<LedgerEntry> findByWallet_IdOrderByCreatedAtAsc(String walletId);

    void deleteByTransaction_Id(String transactionId);

    /**
     * The source-of-truth balance: sum of every CREDIT minus every DEBIT
     * ever posted to this wallet. Used by the reconciliation job to verify
     * {@code Wallet.balance} hasn't drifted.
     */
    @Query("""
            select coalesce(sum(case when e.entryType = lk.ceylonpay.entity.LedgerEntryType.CREDIT then e.amount
                                      else -e.amount end), 0)
            from LedgerEntry e
            where e.wallet.id = :walletId
            """)
    BigDecimal computeBalance(@Param("walletId") String walletId);

    List<LedgerEntry> findByEntryType(LedgerEntryType entryType);

}
