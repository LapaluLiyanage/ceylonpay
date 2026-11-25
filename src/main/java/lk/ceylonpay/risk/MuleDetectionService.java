package lk.ceylonpay.risk;

import lk.ceylonpay.dto.MuleSuspectResponse;
import lk.ceylonpay.entity.ScamReportStatus;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.ScamReportRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.service.SafetyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Finds accounts that behave like money mules, for a human to look at. An account is only a
 * suspect if it received from at least {@value #MIN_SENDERS} different people in the window
 * <em>and</em> shows at least one more sign: it passes most of the money on, it is new, or it
 * has already been reported. Nothing here moves or blocks money by itself.
 */
@Service
public class MuleDetectionService {

    static final int MIN_SENDERS = 3;
    static final BigDecimal PASS_THROUGH_RATIO = new BigDecimal("0.8");
    static final long NEW_ACCOUNT_DAYS = 14;

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final ScamReportRepository scamReportRepository;
    private final SafetyService safetyService;
    private final Clock clock;

    public MuleDetectionService(TransactionRepository transactionRepository, WalletRepository walletRepository,
                                ScamReportRepository scamReportRepository, SafetyService safetyService,
                                Clock clock) {
        this.transactionRepository = transactionRepository;
        this.walletRepository = walletRepository;
        this.scamReportRepository = scamReportRepository;
        this.safetyService = safetyService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MuleSuspectResponse> findSuspects(int hours) {
        int window = Math.max(1, Math.min(hours, 24 * 7));
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.systemDefault()));
        LocalDateTime since = now.minusHours(window);

        List<MuleSuspectResponse> suspects = new ArrayList<>();
        for (MuleCandidate candidate : transactionRepository.findReceiversWithManySenders(since, MIN_SENDERS)) {
            Wallet wallet = walletRepository.findById(candidate.walletId()).orElse(null);
            if (wallet == null) {
                continue;
            }
            User user = wallet.getUser();
            BigDecimal sentOn = transactionRepository.sumSentSince(wallet.getId(), since);

            List<String> flags = new ArrayList<>();
            if (candidate.received().signum() > 0
                    && sentOn.compareTo(candidate.received().multiply(PASS_THROUGH_RATIO)) >= 0) {
                flags.add("PASS_THROUGH");
            }
            long ageDays = user.getCreatedAt() == null ? Long.MAX_VALUE
                    : Duration.between(user.getCreatedAt(), now).toDays();
            if (ageDays < NEW_ACCOUNT_DAYS) {
                flags.add("NEW_ACCOUNT");
            }
            if (scamReportRepository.countAgainstReceiver(wallet.getId(), ScamReportStatus.UPHELD)
                    + scamReportRepository.countAgainstReceiver(wallet.getId(), ScamReportStatus.OPEN) > 0) {
                flags.add("REPORTED");
            }
            if (flags.isEmpty()) {
                continue;
            }
            suspects.add(new MuleSuspectResponse(user.getId(), user.getName(), user.getPhone(),
                    candidate.senders(), candidate.received(), sentOn,
                    ageDays == Long.MAX_VALUE ? -1 : ageDays, List.copyOf(flags),
                    safetyService.isReviewHeld(user.getId())));
        }
        suspects.sort(Comparator.comparingInt((MuleSuspectResponse s) -> s.flags().size()).reversed()
                .thenComparing(Comparator.comparing(MuleSuspectResponse::received).reversed()));
        return suspects;
    }

}
