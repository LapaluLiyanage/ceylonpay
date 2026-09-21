package lk.ceylonpay.entity;

public enum IdempotencyStatus {
    /** Request accepted, business logic not finished yet — used to detect concurrent duplicate requests. */
    IN_PROGRESS,
    /** Business logic finished; responseBody holds the cached result to replay on retry. */
    COMPLETED,
    /** Business logic failed; safe to let the client retry with the same key. */
    FAILED
}
