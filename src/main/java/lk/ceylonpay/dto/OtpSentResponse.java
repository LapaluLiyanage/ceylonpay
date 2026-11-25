package lk.ceylonpay.dto;

/**
 * {@code required} is false when one-time codes are switched off. {@code devCode} is only ever filled in
 * when {@code ceylonpay.sms.dev-code-in-response=true}, for local demos without an SMS provider.
 */
public record OtpSentResponse(boolean required, String devCode) {
}
