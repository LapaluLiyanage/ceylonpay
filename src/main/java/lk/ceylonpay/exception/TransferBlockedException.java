package lk.ceylonpay.exception;

/** A transfer was stopped by the sender's own safety settings (freeze or limit), not by a system error. */
public class TransferBlockedException extends RuntimeException {

    public TransferBlockedException(String message) {
        super(message);
    }

}
