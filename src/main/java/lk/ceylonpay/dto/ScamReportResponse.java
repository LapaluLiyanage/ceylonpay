package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A scam report as the admin queue sees it. */
public record ScamReportResponse(
        String id,
        String transactionId,
        String status,
        String note,
        BigDecimal amount,
        String senderName,
        String senderPhone,
        String receiverName,
        String receiverPhone,
        BigDecimal receiverBalance,
        BigDecimal recoveredAmount,
        LocalDateTime createdAt
) {
}
