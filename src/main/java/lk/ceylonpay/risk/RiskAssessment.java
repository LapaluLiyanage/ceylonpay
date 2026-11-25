package lk.ceylonpay.risk;

import java.util.List;

public record RiskAssessment(int score, RiskOutcome outcome, List<RiskReason> reasons) {

    public static RiskAssessment allow() {
        return new RiskAssessment(0, RiskOutcome.ALLOW, List.of());
    }

}
