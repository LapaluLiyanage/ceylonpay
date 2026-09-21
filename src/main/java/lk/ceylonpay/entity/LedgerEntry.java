package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A single, immutable double-entry ledger row.
 *
 * <p>Every transfer produces exactly two rows: a DEBIT on the sender's wallet
 * and a CREDIT on the receiver's wallet, both pointing at the same
 * {@link Transaction}. A wallet's balance is never trusted as a mutable
 * column in isolation — it is always re-derivable as
 * {@code SUM(CREDIT) - SUM(DEBIT)} over this table for that wallet.
 * {@link Wallet#getBalance()} is kept as a fast, cached read model that the
 * reconciliation job continuously checks against this source of truth.</p>
 */
@Entity
@Table(name = "ledger_entries", indexes = {
        @Index(name = "idx_ledger_wallet", columnList = "wallet_id"),
        @Index(name = "idx_ledger_transaction", columnList = "transaction_id")
})
@Getter
@Setter
@NoArgsConstructor
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "wallet_id", nullable = false, updatable = false)
    private Wallet wallet;

    @ManyToOne
    @JoinColumn(name = "transaction_id", nullable = false, updatable = false)
    private Transaction transaction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private LedgerEntryType entryType;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    /** Snapshot of the wallet's derived balance immediately after this entry — for fast reads and auditing. */
    @Column(name = "balance_after", nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal balanceAfter;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public LedgerEntry(Wallet wallet, Transaction transaction, LedgerEntryType entryType,
                        BigDecimal amount, BigDecimal balanceAfter) {
        this.wallet = wallet;
        this.transaction = transaction;
        this.entryType = entryType;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
    }

}
