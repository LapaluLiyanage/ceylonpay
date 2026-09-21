package lk.ceylonpay.dto;

import lk.ceylonpay.entity.LedgerEntryType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LedgerEntryResponse(
        String id,
        String transactionId,
        LedgerEntryType entryType,
        BigDecimal amount,
        BigDecimal balanceAfter,
        LocalDateTime createdAt
) {
}
