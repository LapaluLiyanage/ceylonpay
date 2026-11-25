package lk.ceylonpay.risk;

import lk.ceylonpay.entity.ScamReportStatus;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.dto.MuleSuspectResponse;
import lk.ceylonpay.repository.ScamReportRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.service.SafetyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MuleDetectionServiceTest {

    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");

    @Mock
    private TransactionRepository transactions;

    @Mock
    private WalletRepository wallets;

    @Mock
    private ScamReportRepository reports;

    @Mock
    private SafetyService safety;

    private MuleDetectionService service() {
        Instant noon = LocalDateTime.parse("2026-03-10T12:00:00").atZone(COLOMBO).toInstant();
        return new MuleDetectionService(transactions, wallets, reports, safety, Clock.fixed(noon, COLOMBO));
    }

    private Wallet wallet(String id, int ageDays) {
        Instant noon = LocalDateTime.parse("2026-03-10T12:00:00").atZone(COLOMBO).toInstant();
        User user = new User();
        user.setId("u-" + id);
        user.setName("User " + id);
        user.setPhone("+94770000000");
        user.setCreatedAt(LocalDateTime.ofInstant(noon, ZoneId.systemDefault()).minusDays(ageDays));
        Wallet w = new Wallet();
        w.setId(id);
        w.setUser(user);
        return w;
    }

    @Test
    void flagsAnAccountThatCollectsFromManyPeopleAndPassesTheMoneyOn() {
        when(transactions.findReceiversWithManySenders(any(), anyLong()))
                .thenReturn(List.of(new MuleCandidate("w1", 6, new BigDecimal("50000"))));
        when(wallets.findById("w1")).thenReturn(Optional.of(wallet("w1", 200)));
        when(transactions.sumSentSince(org.mockito.ArgumentMatchers.eq("w1"), any())).thenReturn(new BigDecimal("45000"));

        List<MuleSuspectResponse> result = service().findSuspects(24);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).flags()).containsExactly("PASS_THROUGH");
        assertThat(result.get(0).senders()).isEqualTo(6);
    }

    @Test
    void ignoresAnEstablishedAccountThatSimplyKeepsItsMoney() {
        when(transactions.findReceiversWithManySenders(any(), anyLong()))
                .thenReturn(List.of(new MuleCandidate("w2", 4, new BigDecimal("8000"))));
        when(wallets.findById("w2")).thenReturn(Optional.of(wallet("w2", 400)));
        when(transactions.sumSentSince(org.mockito.ArgumentMatchers.eq("w2"), any())).thenReturn(new BigDecimal("500"));
        when(reports.countAgainstReceiver("w2", ScamReportStatus.UPHELD)).thenReturn(0L);
        when(reports.countAgainstReceiver("w2", ScamReportStatus.OPEN)).thenReturn(0L);

        assertThat(service().findSuspects(24)).isEmpty();
    }

    @Test
    void newAndReportedAccountsGetTheirOwnFlags() {
        when(transactions.findReceiversWithManySenders(any(), anyLong()))
                .thenReturn(List.of(new MuleCandidate("w3", 3, new BigDecimal("3000"))));
        when(wallets.findById("w3")).thenReturn(Optional.of(wallet("w3", 2)));
        when(transactions.sumSentSince(org.mockito.ArgumentMatchers.eq("w3"), any())).thenReturn(BigDecimal.ZERO);
        when(reports.countAgainstReceiver("w3", ScamReportStatus.UPHELD)).thenReturn(1L);
        when(reports.countAgainstReceiver("w3", ScamReportStatus.OPEN)).thenReturn(0L);
        when(safety.isReviewHeld("u-w3")).thenReturn(true);

        MuleSuspectResponse suspect = service().findSuspects(24).get(0);

        assertThat(suspect.flags()).containsExactly("NEW_ACCOUNT", "REPORTED");
        assertThat(suspect.onHold()).isTrue();
    }

}
