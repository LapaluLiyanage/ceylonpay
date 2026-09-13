package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TransactionHistoryResponse(
        String id,
        String direction,
        String counterpartyName,
        String counterpartyPhone,
        BigDecimal amount,
        LocalDateTime timestamp
) {
}
