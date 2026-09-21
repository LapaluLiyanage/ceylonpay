package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ReconciliationResponse(
        String walletId,
        BigDecimal cachedBalance,
        BigDecimal ledgerBalance,
        LocalDateTime detectedAt
) {
}
