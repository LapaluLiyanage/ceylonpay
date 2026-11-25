package lk.ceylonpay.risk;

import lk.ceylonpay.entity.ScamReportStatus;
import lk.ceylonpay.entity.TransactionStatus;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.ScamReportRepository;
import lk.ceylonpay.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Scam Shield v1: a transparent, rule-based risk score from 0 to 100.
 *
 * <p>Every rule that fires adds points and a plain-English reason, so the sender can always
 * be told why a transfer was questioned. The score never changes how money moves by itself:
 * below {@value #WARN_AT} the transfer goes through, from {@value #WARN_AT} the sender must
 * confirm again, and from {@value #HOLD_AT} it is held for review and no money moves.</p>
 *
 * <p>All signals are read from existing transaction history; nothing here writes.</p>
 */
@Service
public class RiskService {

    public static final int WARN_AT = 40;
    public static final int HOLD_AT = 75;

    private final TransactionRepository transactionRepository;
    private final ScamReportRepository scamReportRepository;
    private final Clock clock;

    public RiskService(TransactionRepository transactionRepository, ScamReportRepository scamReportRepository,
                       Clock clock) {
        this.transactionRepository = transactionRepository;
        this.scamReportRepository = scamReportRepository;
        this.clock = clock;
    }

    public RiskAssessment assess(Wallet sender, Wallet receiver, BigDecimal amount) {
        List<RiskReason> reasons = new ArrayList<>();
        // Stored timestamps are in the JVM's zone, so compare windows in that zone.
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.systemDefault()));

        senderSignals(sender, receiver, amount, now, reasons);
        receiverSignals(receiver, now, reasons);

        int score = Math.min(100, reasons.stream().mapToInt(RiskReason::points).sum());
        RiskOutcome outcome = score >= HOLD_AT ? RiskOutcome.HOLD : score >= WARN_AT ? RiskOutcome.WARN : RiskOutcome.ALLOW;
        return new RiskAssessment(score, outcome, List.copyOf(reasons));
    }

    private void senderSignals(Wallet sender, Wallet receiver, BigDecimal amount, LocalDateTime now,
                               List<RiskReason> reasons) {
        if (transactionRepository.countBySender_IdAndReceiver_IdAndStatus(
                sender.getId(), receiver.getId(), TransactionStatus.SUCCESS) == 0) {
            reasons.add(new RiskReason("FIRST_PAYMENT", "You have never paid this number before.", 25));
        }

        long pastPayments = transactionRepository.countBySender_IdAndStatus(sender.getId(), TransactionStatus.SUCCESS);
        if (pastPayments >= 3) {
            Double average = transactionRepository.averageSentAmount(sender.getId());
            if (average != null && average > 0) {
                BigDecimal usual = BigDecimal.valueOf(average);
                String usualText = usual.setScale(0, RoundingMode.HALF_UP).toPlainString();
                if (amount.compareTo(usual.multiply(BigDecimal.valueOf(5))) > 0) {
                    reasons.add(new RiskReason("UNUSUAL_AMOUNT",
                            "This is much more than you usually send (about Rs. " + usualText + ").", 25,
                            java.util.Map.of("usual", usualText)));
                } else if (amount.compareTo(usual.multiply(BigDecimal.valueOf(3))) > 0) {
                    reasons.add(new RiskReason("LARGER_THAN_USUAL",
                            "This is more than you usually send (about Rs. " + usualText + ").", 15,
                            java.util.Map.of("usual", usualText)));
                }
            }
        }

        BigDecimal balance = sender.getBalance();
        if (balance != null && balance.signum() > 0) {
            BigDecimal share = amount.divide(balance, 4, RoundingMode.HALF_UP);
            if (share.compareTo(new BigDecimal("0.90")) >= 0) {
                reasons.add(new RiskReason("MOST_OF_BALANCE", "This sends almost all of your balance.", 20));
            } else if (share.compareTo(new BigDecimal("0.50")) >= 0) {
                reasons.add(new RiskReason("HALF_OF_BALANCE", "This sends more than half of your balance.", 10));
            }
        }

        if (transactionRepository.countBySender_IdAndCreatedAtAfter(sender.getId(), now.minusMinutes(10)) >= 3) {
            reasons.add(new RiskReason("RAPID_PAYMENTS", "You have made several payments in the last few minutes.", 15));
        }

        int hour = ZonedDateTime.now(clock).getHour();
        if (hour < 5) {
            reasons.add(new RiskReason("LATE_NIGHT", "It is the middle of the night, when scams are common.", 10));
        }
    }

    private void receiverSignals(Wallet receiver, LocalDateTime now, List<RiskReason> reasons) {
        LocalDateTime created = receiver.getUser() == null ? null : receiver.getUser().getCreatedAt();
        if (created != null) {
            Duration age = Duration.between(created, now);
            if (age.toDays() < 3) {
                reasons.add(new RiskReason("NEW_RECEIVER", "This account was opened very recently.", 25));
            } else if (age.toDays() < 14) {
                reasons.add(new RiskReason("YOUNG_RECEIVER", "This account is less than two weeks old.", 10));
            }
        }

        // Reports from other users are the strongest signal there is.
        if (scamReportRepository.countAgainstReceiver(receiver.getId(), ScamReportStatus.UPHELD) > 0) {
            reasons.add(new RiskReason("REPORTED_SCAM",
                    "Other people have reported this account for taking their money in a scam.", 45));
        } else if (scamReportRepository.countAgainstReceiver(receiver.getId(), ScamReportStatus.OPEN) > 0) {
            reasons.add(new RiskReason("REPORT_PENDING",
                    "Someone has reported this account and it is being reviewed.", 25));
        }

        LocalDateTime dayAgo = now.minusHours(24);
        long senders = transactionRepository.countDistinctSendersSince(receiver.getId(), dayAgo);
        if (senders >= 5) {
            reasons.add(new RiskReason("MANY_SENDERS", "This account received money from " + senders
                    + " different people today.", 20, java.util.Map.of("count", String.valueOf(senders))));
        } else if (senders >= 3) {
            reasons.add(new RiskReason("SEVERAL_SENDERS", "This account received money from " + senders
                    + " different people today.", 10, java.util.Map.of("count", String.valueOf(senders))));
        }

        if (senders >= 3) {
            BigDecimal received = transactionRepository.sumReceivedFromUsersSince(receiver.getId(), dayAgo);
            BigDecimal sentOn = transactionRepository.sumSentSince(receiver.getId(), dayAgo);
            if (received.signum() > 0 && sentOn.compareTo(received.multiply(new BigDecimal("0.8"))) >= 0) {
                reasons.add(new RiskReason("PASS_THROUGH",
                        "Money sent to this account is being passed on straight away.", 15));
            }
        }
    }

}
