package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Recorded whenever the nightly {@code ReconciliationService} finds that a
 * wallet's cached {@code balance} column disagrees with the balance derived
 * from summing its {@link LedgerEntry} rows. In a real payment system this
 * would page whoever's on call; here it's surfaced through
 * {@code GET /api/admin/reconciliation}.
 */
@Entity
@Table(name = "reconciliation_discrepancies")
@Getter
@Setter
@NoArgsConstructor
public class ReconciliationDiscrepancy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "cached_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal cachedBalance;

    @Column(name = "ledger_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal ledgerBalance;

    @Column(name = "resolved", nullable = false)
    private boolean resolved = false;

    @CreationTimestamp
    @Column(name = "detected_at", nullable = false, updatable = false)
    private LocalDateTime detectedAt;

    public ReconciliationDiscrepancy(String walletId, BigDecimal cachedBalance, BigDecimal ledgerBalance) {
        this.walletId = walletId;
        this.cachedBalance = cachedBalance;
        this.ledgerBalance = ledgerBalance;
    }

}
