package lk.ceylonpay.exception;

/** A one-time code was wrong, expired, used up, or asked for too soon. Maps to 400 (never 401, which means "sign in again"). */
public class InvalidOtpException extends RuntimeException {

    public InvalidOtpException(String message) {
        super(message);
    }

}
