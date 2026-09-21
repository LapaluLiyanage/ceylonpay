package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "wallets")
@Getter
@Setter
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /**
     * Cached read model, not the source of truth. The true balance is derived
     * from {@link LedgerEntry} rows; this column exists purely so a balance
     * check doesn't require summing the whole ledger on every request. The
     * reconciliation job keeps it honest.
     */
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal balance = BigDecimal.ZERO;

    /**
     * Optimistic-locking version. Two concurrent transfers debiting the same
     * wallet will race to update this row; the second writer's UPDATE affects
     * zero rows, Hibernate throws {@link org.springframework.orm.ObjectOptimisticLockingFailureException},
     * and {@code TransferService} retries instead of silently overwriting the
     * other transfer's balance change.
     */
    @Version
    private Long version;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

}
