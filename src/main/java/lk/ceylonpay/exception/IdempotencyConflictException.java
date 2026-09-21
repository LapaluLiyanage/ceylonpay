package lk.ceylonpay.exception;

/** Thrown when an {@code Idempotency-Key} is reused with a different request body than the first time. */
public class IdempotencyConflictException extends RuntimeException {

    public IdempotencyConflictException(String message) {
        super(message);
    }

}
