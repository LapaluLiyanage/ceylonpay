package lk.ceylonpay.exception;

import lk.ceylonpay.risk.RiskAssessment;

/** The transfer looks risky enough that the sender must confirm it again with {@code acknowledgeRisk=true}. */
public class RiskWarningException extends RuntimeException {

    private final transient RiskAssessment assessment;

    public RiskWarningException(RiskAssessment assessment) {
        super("This transfer looks risky. Review the warnings and confirm to continue.");
        this.assessment = assessment;
    }

    public RiskAssessment getAssessment() {
        return assessment;
    }

}
