package lk.ceylonpay.risk;

import lk.ceylonpay.entity.TransactionStatus;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskServiceTest {

    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");

    @Mock
    private TransactionRepository transactions;

    @Mock
    private lk.ceylonpay.repository.ScamReportRepository reports;

    /** Midday in Sri Lanka, so the late-night rule stays out of the way. */
    private RiskService service() {
        Instant noon = LocalDateTime.parse("2026-03-10T12:00:00").atZone(COLOMBO).toInstant();
        return new RiskService(transactions, reports, Clock.fixed(noon, COLOMBO));
    }

    private LocalDateTime now() {
        Instant noon = LocalDateTime.parse("2026-03-10T12:00:00").atZone(COLOMBO).toInstant();
        return LocalDateTime.ofInstant(noon, ZoneId.systemDefault());
    }

    private Wallet wallet(String id, String balance, int accountAgeDays) {
        User user = new User();
        user.setId("user-" + id);
        user.setCreatedAt(now().minusDays(accountAgeDays));
        Wallet wallet = new Wallet();
        wallet.setId(id);
        wallet.setUser(user);
        wallet.setBalance(new BigDecimal(balance));
        return wallet;
    }

    @Test
    void ordinaryPaymentToSomeoneYouKnowIsAllowed() {
        Wallet sender = wallet("s", "5000", 200);
        Wallet receiver = wallet("r", "100", 200);
        when(transactions.countBySender_IdAndReceiver_IdAndStatus("s", "r", TransactionStatus.SUCCESS)).thenReturn(4L);
        when(transactions.countBySender_IdAndStatus("s", TransactionStatus.SUCCESS)).thenReturn(10L);
        when(transactions.averageSentAmount("s")).thenReturn(800.0);

        RiskAssessment result = service().assess(sender, receiver, new BigDecimal("700"));

        assertThat(result.outcome()).isEqualTo(RiskOutcome.ALLOW);
        assertThat(result.score()).isZero();
        assertThat(result.reasons()).isEmpty();
    }

    @Test
    void aBrandNewUsersFirstSmallPaymentIsNotTreatedAsSuspicious() {
        Wallet sender = wallet("s", "5000", 1);
        Wallet receiver = wallet("r", "100", 200);

        RiskAssessment result = service().assess(sender, receiver, new BigDecimal("300"));

        assertThat(result.outcome()).isEqualTo(RiskOutcome.ALLOW);
        assertThat(result.reasons()).extracting(RiskReason::code).containsExactly("FIRST_PAYMENT");
    }

    @Test
    void firstPaymentOfAlmostEverythingAsksForConfirmation() {
        Wallet sender = wallet("s", "10000", 100);
        Wallet receiver = wallet("r", "0", 200);

        RiskAssessment result = service().assess(sender, receiver, new BigDecimal("9500"));

        assertThat(result.score()).isEqualTo(45);
        assertThat(result.outcome()).isEqualTo(RiskOutcome.WARN);
        assertThat(result.reasons()).extracting(RiskReason::code).containsExactly("FIRST_PAYMENT", "MOST_OF_BALANCE");
    }

    @Test
    void largePaymentToANewAccountThatIsCollectingMoneyIsHeld() {
        Wallet sender = wallet("s", "50000", 300);
        Wallet receiver = wallet("r", "0", 2);
        when(transactions.countBySender_IdAndStatus("s", TransactionStatus.SUCCESS)).thenReturn(5L);
        when(transactions.averageSentAmount("s")).thenReturn(1000.0);
        when(transactions.countDistinctSendersSince(eq("r"), any())).thenReturn(14L);
        when(transactions.sumReceivedFromUsersSince(eq("r"), any())).thenReturn(new BigDecimal("60000"));
        when(transactions.sumSentSince(eq("r"), any())).thenReturn(new BigDecimal("55000"));

        RiskAssessment result = service().assess(sender, receiver, new BigDecimal("45000"));

        assertThat(result.outcome()).isEqualTo(RiskOutcome.HOLD);
        assertThat(result.score()).isEqualTo(100);
        assertThat(result.reasons()).extracting(RiskReason::code)
                .contains("FIRST_PAYMENT", "UNUSUAL_AMOUNT", "MOST_OF_BALANCE", "NEW_RECEIVER", "MANY_SENDERS",
                        "PASS_THROUGH");
    }

}
