package lk.ceylonpay.risk;

import java.math.BigDecimal;

/** A wallet that received money from several different people in a window (raw query row). */
public record MuleCandidate(String walletId, long senders, BigDecimal received) {
}
