package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "scam_reports")
@Getter
@Setter
@NoArgsConstructor
public class ScamReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** One report per transfer. */
    @OneToOne
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    private Transaction transaction;

    @Column(name = "reporter_user_id", nullable = false)
    private String reporterUserId;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScamReportStatus status = ScamReportStatus.OPEN;

    @Column(name = "recovered_amount", precision = 19, scale = 4)
    private BigDecimal recoveredAmount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by")
    private String resolvedBy;

    public ScamReport(Transaction transaction, String reporterUserId, String note) {
        this.transaction = transaction;
        this.reporterUserId = reporterUserId;
        this.note = note;
    }

}
