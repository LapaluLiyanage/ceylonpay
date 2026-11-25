package lk.ceylonpay.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TransferRequest(

        @NotBlank
        String toPhone,

        @NotNull
        @DecimalMin(value = "1.00")
        BigDecimal amount,

        /** Set by the client after the sender has seen and accepted a risk warning. */
        /** Optional; absent means false. */
        Boolean acknowledgeRisk

) {
}
