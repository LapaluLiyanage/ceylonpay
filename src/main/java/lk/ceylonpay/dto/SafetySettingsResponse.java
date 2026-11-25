package lk.ceylonpay.dto;

import java.math.BigDecimal;

public record SafetySettingsResponse(boolean frozen, BigDecimal dailyLimit, BigDecimal nightLimit,
                                     int nightStartHour, int nightEndHour) {
}
