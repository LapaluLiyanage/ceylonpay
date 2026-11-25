package lk.ceylonpay.risk;

public enum RiskOutcome {
    /** Let it through. */
    ALLOW,
    /** Show the reasons and make the sender confirm a second time. */
    WARN,
    /** Do not move money; queue for review. */
    HOLD
}
