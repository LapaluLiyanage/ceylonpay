package lk.ceylonpay.exception;

/** This action needs a one-time code that the request did not include. Maps to 428. */
public class OtpRequiredException extends RuntimeException {

    public OtpRequiredException() {
        super("A confirmation code is required. We have not sent one yet: request a code first.");
    }

}
