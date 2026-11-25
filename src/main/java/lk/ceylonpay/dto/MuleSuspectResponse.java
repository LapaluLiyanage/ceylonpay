package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.util.List;

/** An account that looks like a money mule: collects from many people and/or passes money straight on. */
public record MuleSuspectResponse(
        String userId,
        String name,
        String phone,
        long senders,
        BigDecimal received,
        BigDecimal sentOn,
        long accountAgeDays,
        List<String> flags,
        boolean onHold
) {
}
