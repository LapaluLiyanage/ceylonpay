package lk.ceylonpay.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.dto.ScamReportResponse;
import lk.ceylonpay.entity.AuditLog;
import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.entity.ScamReport;
import lk.ceylonpay.entity.ScamReportStatus;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.TransactionStatus;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.OutboxEventRepository;
import lk.ceylonpay.repository.ScamReportRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Report and recover. A sender reports a completed transfer as a scam; the receiver's outgoing
 * money is put on hold straight away so it cannot be moved on while a reviewer looks. If the
 * reviewer upholds the report, the money is pulled back through the ledger as a new
 * counter-transfer (never by editing history); otherwise the hold is lifted.
 */
@Service
public class ScamReportService {

    /** How long after a transfer it can still be reported. */
    static final Duration REPORT_WINDOW = Duration.ofDays(30);

    private final ScamReportRepository reportRepository;
    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final AuditLogRepository auditLogRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final LedgerService ledgerService;
    private final SafetyService safetyService;
    private final AuditTrail auditTrail;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public ScamReportService(ScamReportRepository reportRepository, TransactionRepository transactionRepository,
                             WalletRepository walletRepository, AuditLogRepository auditLogRepository,
                             OutboxEventRepository outboxEventRepository, LedgerService ledgerService,
                             SafetyService safetyService, AuditTrail auditTrail, ObjectMapper objectMapper,
                             Clock clock) {
        this.reportRepository = reportRepository;
        this.transactionRepository = transactionRepository;
        this.walletRepository = walletRepository;
        this.auditLogRepository = auditLogRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.ledgerService = ledgerService;
        this.safetyService = safetyService;
        this.auditTrail = auditTrail;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public ScamReportResponse report(String reporterUserId, String transactionId, String note) {
        Transaction txn = transactionRepository.findById(transactionId)
                .filter(t -> t.getSender().getUser().getId().equals(reporterUserId))
                // Same answer as "doesn't exist" so other people's transfer ids can't be probed.
                .orElseThrow(() -> new WalletNotFoundException("Transfer not found"));
        if (!TransactionStatus.SUCCESS.equals(txn.getStatus())) {
            throw new InvalidTransferException("Only a completed transfer can be reported");
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.systemDefault()));
        if (Duration.between(txn.getCreatedAt(), now).compareTo(REPORT_WINDOW) > 0) {
            throw new InvalidTransferException("This transfer is too old to report here");
        }
        if (reportRepository.findByTransaction_Id(transactionId).isPresent()) {
            throw new InvalidTransferException("This transfer has already been reported");
        }

        ScamReport report = reportRepository.save(new ScamReport(txn, reporterUserId, note));
        // Stop the money moving on while a reviewer looks.
        safetyService.setReviewHold(txn.getReceiver().getUser().getId(), true);
        auditTrail.append(txn.getId(), "REPORTED as scam");
        outboxEventRepository.save(new OutboxEvent("Transaction", txn.getId(), "transfer.reported", "{}"));
        return toResponse(report);
    }

    @Transactional(readOnly = true)
    public List<ScamReportResponse> list(ScamReportStatus status) {
        return reportRepository.findByStatusOrderByCreatedAtAsc(status).stream().map(this::toResponse).toList();
    }

    /**
     * Reviewer decision. {@code uphold} pulls back whatever the receiver still has (up to the
     * amount sent); {@code !uphold} just lifts the hold. Either way the report closes.
     */
    @Retryable(
            retryFor = ObjectOptimisticLockingFailureException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 50, multiplier = 2)
    )
    @Transactional
    public ScamReportResponse resolve(String reportId, boolean uphold, String reviewerId) {
        ScamReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new WalletNotFoundException("Report not found"));
        if (report.getStatus() != ScamReportStatus.OPEN) {
            throw new InvalidTransferException("This report has already been resolved");
        }

        Transaction original = report.getTransaction();
        Wallet receiver = original.getReceiver();

        if (uphold) {
            report.setRecoveredAmount(recover(original, reviewerId));
            report.setStatus(ScamReportStatus.UPHELD);
        } else {
            report.setStatus(ScamReportStatus.DISMISSED);
            auditTrail.append(original.getId(), "REPORT DISMISSED by " + reviewerId);
        }
        report.setResolvedAt(LocalDateTime.now(clock.withZone(ZoneId.systemDefault())));
        report.setResolvedBy(reviewerId);
        reportRepository.save(report);

        // Lift the hold unless someone else has reported the same account and is still waiting.
        if (reportRepository.countAgainstReceiver(receiver.getId(), ScamReportStatus.OPEN) == 0) {
            safetyService.setReviewHold(receiver.getUser().getId(), false);
        }
        return toResponse(report);
    }

    /** Counter-transfer from the receiver back to the sender; returns how much actually came back. */
    private BigDecimal recover(Transaction original, String reviewerId) {
        Wallet sender = original.getSender();
        Wallet receiver = original.getReceiver();
        BigDecimal recovered = receiver.getBalance().min(original.getAmount());

        if (recovered.signum() > 0) {
            receiver.setBalance(receiver.getBalance().subtract(recovered));
            sender.setBalance(sender.getBalance().add(recovered));
            walletRepository.save(receiver);
            walletRepository.save(sender);

            Transaction reversal = new Transaction(receiver, sender, recovered, TransactionStatus.REVERSAL);
            transactionRepository.saveAndFlush(reversal);
            ledgerService.postTransfer(reversal, receiver, sender, recovered);
            auditLogRepository.save(new AuditLog(reversal, "REVERSAL of " + original.getId() + " by " + reviewerId));
            outboxEventRepository.save(new OutboxEvent("Transaction", reversal.getId(), "transfer.reversed",
                    writeJson(java.util.Map.of("original", original.getId(), "recovered", recovered))));
        }

        original.setStatus(TransactionStatus.REVERSED);
        transactionRepository.save(original);
        auditTrail.append(original.getId(), "SCAM UPHELD by " + reviewerId + ", recovered " + recovered.toPlainString());
        return recovered;
    }

    private ScamReportResponse toResponse(ScamReport r) {
        Transaction t = r.getTransaction();
        return new ScamReportResponse(
                r.getId(),
                t.getId(),
                r.getStatus().name(),
                r.getNote(),
                t.getAmount(),
                t.getSender().getUser().getName(),
                t.getSender().getUser().getPhone(),
                t.getReceiver().getUser().getName(),
                t.getReceiver().getUser().getPhone(),
                t.getReceiver().getBalance(),
                r.getRecoveredAmount(),
                r.getCreatedAt());
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize outbox payload", e);
        }
    }

}
