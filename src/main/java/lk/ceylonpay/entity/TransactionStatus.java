package lk.ceylonpay.entity;

/** Values stored in {@code transactions.status}. */
public final class TransactionStatus {

    /** Money moved. */
    public static final String SUCCESS = "SUCCESS";
    /** Held by the scam check; no money has moved yet. */
    public static final String PENDING_REVIEW = "PENDING_REVIEW";
    /** A reviewer declined a held transfer; no money moved. */
    public static final String REJECTED = "REJECTED";
    /** The sender withdrew a held transfer; no money moved. */
    public static final String CANCELLED = "CANCELLED";

    /** A completed transfer that was reported as a scam and pulled back. */
    public static final String REVERSED = "REVERSED";
    /** The counter-transfer that pulls money back to the sender of a reversed transfer. */
    public static final String REVERSAL = "REVERSAL";

    private TransactionStatus() {
    }

}
