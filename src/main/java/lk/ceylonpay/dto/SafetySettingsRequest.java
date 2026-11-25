package lk.ceylonpay.dto;

import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

/** Null limit means "no limit". */
public record SafetySettingsRequest(

        boolean frozen,

        @DecimalMin(value = "1.00")
        BigDecimal dailyLimit,

        @DecimalMin(value = "1.00")
        BigDecimal nightLimit

) {
}
