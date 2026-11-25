package lk.ceylonpay.entity;

public enum OtpPurpose {
    /** Proves the user owns the phone number they registered with. */
    REGISTER,
    /** Extra confirmation for one specific risky transfer. */
    TRANSFER
}
