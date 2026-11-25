package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A transfer waiting in the review queue. {@code detail} holds the score and reason codes. */
public record HeldTransferResponse(
        String id,
        String senderName,
        String senderPhone,
        String receiverName,
        String receiverPhone,
        BigDecimal amount,
        LocalDateTime createdAt,
        String detail
) {
}
