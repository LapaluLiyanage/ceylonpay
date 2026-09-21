package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Deduplicates client-retried write requests (e.g. a mobile client that
 * double-taps "Send" or retries after a timed-out response).
 *
 * <p>The client sends an {@code Idempotency-Key} header on every transfer
 * request. The first time a key is seen, the request is processed and its
 * outcome cached here. Any later request with the same key returns the
 * cached outcome instead of moving money twice — this is the same pattern
 * Stripe and most production payment APIs use.</p>
 */
@Entity
@Table(name = "idempotency_keys")
@Getter
@Setter
@NoArgsConstructor
public class IdempotencyKey {

    /** The client-supplied idempotency key itself is the primary key — no separate id needed. */
    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    /** Hash of the request body — lets us detect the same key reused with a *different* payload. */
    @Column(name = "request_hash", nullable = false)
    private String requestHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IdempotencyStatus status;

    @Lob
    @Column(name = "response_body")
    private String responseBody;

    @Column(name = "response_status")
    private Integer responseStatus;

    @Version
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public IdempotencyKey(String id, String userId, String requestHash) {
        this.id = id;
        this.userId = userId;
        this.requestHash = requestHash;
        this.status = IdempotencyStatus.IN_PROGRESS;
    }

}
