package lk.ceylonpay.risk;

/**
 * One signal that raised the score. {@code code} is stable (used for stored audit text and, later,
 * translations); {@code message} is the plain-English explanation shown to the sender.
 */
public record RiskReason(String code, String message, int points) {
}
