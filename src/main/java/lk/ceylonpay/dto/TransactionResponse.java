package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record TransactionResponse(
        String transactionId,
        BigDecimal amount,
        String recipientPhone,
        BigDecimal newBalance,
        LocalDateTime timestamp,
        String status,
        List<lk.ceylonpay.risk.RiskReason> reasons
) {
}
