package lk.ceylonpay.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A user's own protections. Absent row = defaults (not frozen, no limits). */
@Entity
@Table(name = "safety_settings")
@Getter
@Setter
@NoArgsConstructor
public class SafetySettings {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(nullable = false)
    private boolean frozen;

    /** Set by the system while a scam report against this account is open. The user cannot change it. */
    @Column(name = "review_hold", nullable = false)
    private boolean reviewHold;

    @Column(name = "daily_limit", precision = 19, scale = 4)
    private BigDecimal dailyLimit;

    @Column(name = "night_limit", precision = 19, scale = 4)
    private BigDecimal nightLimit;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public SafetySettings(String userId) {
        this.userId = userId;
    }

}
