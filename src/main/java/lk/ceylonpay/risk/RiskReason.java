package lk.ceylonpay.risk;

import java.util.Map;

/**
 * One signal that raised the score. {@code code} is stable (used for stored audit text and, later,
 * translations); {@code message} is the plain-English explanation shown to the sender, and
 * {@code params} holds the numbers in it so a client can phrase the reason in another language.
 */
public record RiskReason(String code, String message, int points, Map<String, String> params) {

    public RiskReason(String code, String message, int points) {
        this(code, message, points, Map.of());
    }

}
