package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TransactionResponse(
        String transactionId,
        BigDecimal amount,
        String recipientPhone,
        BigDecimal newBalance,
        LocalDateTime timestamp
) {
}
