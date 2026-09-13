package lk.ceylonpay.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DepositRequest(

        @NotNull
        @DecimalMin(value = "1.00")
        BigDecimal amount

) {
}
