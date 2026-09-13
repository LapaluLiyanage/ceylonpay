package lk.ceylonpay.dto;

import java.math.BigDecimal;

public record BalanceResponse(
        String walletId,
        BigDecimal balance
) {
}
