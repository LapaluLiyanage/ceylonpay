package lk.ceylonpay.entity;

public enum ScamReportStatus {
    /** Waiting for a reviewer; the receiver's outgoing money is on hold. */
    OPEN,
    /** A reviewer agreed it was a scam; money was recovered where possible. */
    UPHELD,
    /** A reviewer decided it was not a scam; the hold was lifted. */
    DISMISSED
}
