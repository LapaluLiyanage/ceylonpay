package lk.ceylonpay.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.dto.TransactionHistoryResponse;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.entity.AuditLog;
import lk.ceylonpay.entity.IdempotencyKey;
import lk.ceylonpay.entity.IdempotencyStatus;
import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.IdempotencyConflictException;
import lk.ceylonpay.exception.InsufficientBalanceException;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.OutboxEventRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.dto.OtpSentResponse;
import lk.ceylonpay.entity.OtpPurpose;
import lk.ceylonpay.risk.RiskAssessment;
import lk.ceylonpay.risk.RiskOutcome;
import lk.ceylonpay.risk.RiskService;
import lk.ceylonpay.entity.TransactionStatus;
import lk.ceylonpay.exception.RiskWarningException;
import lk.ceylonpay.util.PhoneNumber;
import org.springframework.context.annotation.Lazy;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class TransferService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final LedgerService ledgerService;
    private final SafetyService safetyService;
    private final RiskService riskService;
    private final OtpService otpService;
    private final IdempotencyService idempotencyService;
    private final ObjectMapper objectMapper;
    private final TransferService self;

    public TransferService(UserRepository userRepository, WalletRepository walletRepository,
                            TransactionRepository transactionRepository, AuditLogRepository auditLogRepository,
                            OutboxEventRepository outboxEventRepository, LedgerService ledgerService, SafetyService safetyService, RiskService riskService, OtpService otpService,
                            IdempotencyService idempotencyService, ObjectMapper objectMapper,
                            @Lazy TransferService self) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.auditLogRepository = auditLogRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.ledgerService = ledgerService;
        this.safetyService = safetyService;
        this.riskService = riskService;
        this.otpService = otpService;
        this.idempotencyService = idempotencyService;
        this.objectMapper = objectMapper;
        // Self-injected Spring proxy: transferIdempotent() below must call transfer() through
        // this proxy (not a bare `this.transfer(...)`), or @Transactional/@Retryable on transfer()
        // never actually apply to the idempotent path.
        this.self = self;
    }

    /**
     * Entry point used by the controller when the client sends an
     * {@code Idempotency-Key} header. Safe to call repeatedly with the same
     * key and the same parameters — only the first call moves money; every
     * later call with that key replays the cached result.
     */
    public TransactionResponse transferIdempotent(String idempotencyKey, String senderUserId,
                                                   String rawToPhone, BigDecimal amount,
                                                   boolean acknowledgeRisk, String otpCode) {
        String toPhone = normalizeRecipient(rawToPhone);
        String requestHash = IdempotencyService.hash(senderUserId + "|" + toPhone + "|" + amount);
        Optional<IdempotencyKey> existing = idempotencyService.begin(idempotencyKey, senderUserId, requestHash);

        if (existing.isPresent()) {
            IdempotencyKey record = existing.get();
            if (record.getStatus() == IdempotencyStatus.COMPLETED) {
                return readCachedResponse(record);
            }
            // IN_PROGRESS: a concurrent request with the same key hasn't finished yet.
            throw new IdempotencyConflictException(
                    "A request with this Idempotency-Key is already being processed");
        }

        try {
            // Call through the injected proxy (`self`), not a bare `transfer(...)`, so
            // @Transactional and @Retryable on transfer() actually take effect here.
            TransactionResponse response = self.transfer(senderUserId, toPhone, amount, acknowledgeRisk, otpCode);
            idempotencyService.complete(idempotencyKey, 200, writeJson(response));
            return response;
        } catch (RuntimeException e) {
            idempotencyService.fail(idempotencyKey);
            throw e;
        }
    }

    /**
     * The core transfer. Retries automatically if it loses an optimistic-locking
     * race against another transfer touching the same wallet — each retry
     * re-reads the wallets fresh and re-validates the balance, so it never
     * blindly overwrites a concurrent update.
     */
    @Retryable(
            retryFor = ObjectOptimisticLockingFailureException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 50, multiplier = 2)
    )
    @Transactional
    public TransactionResponse transfer(String senderUserId, String rawToPhone, BigDecimal amount,
                                         boolean acknowledgeRisk, String otpCode) {
        String toPhone = normalizeRecipient(rawToPhone);
        Wallet senderWallet = walletRepository.findByUserId(senderUserId)
                .orElseThrow(() -> new WalletNotFoundException("Sender wallet not found"));

        User recipientUser = userRepository.findByPhone(toPhone)
                .orElseThrow(() -> new WalletNotFoundException("Recipient not found"));
        Wallet recipientWallet = walletRepository.findByUserId(recipientUser.getId())
                .orElseThrow(() -> new WalletNotFoundException("Recipient wallet not found"));

        if (senderWallet.getId().equals(recipientWallet.getId())) {
            throw new InvalidTransferException("Cannot transfer to your own wallet");
        }
        otpService.requireVerifiedPhone(senderWallet.getUser());
        safetyService.checkOutgoing(senderUserId, senderWallet.getId(), amount);
        if (senderWallet.getBalance().compareTo(amount) < 0) {
            throw new InsufficientBalanceException("Insufficient balance");
        }

        RiskAssessment risk = riskService.assess(senderWallet, recipientWallet, amount);
        if (risk.outcome() == RiskOutcome.HOLD) {
            return holdForReview(senderWallet, recipientWallet, toPhone, amount, risk);
        }
        if (risk.outcome() == RiskOutcome.WARN) {
            if (!acknowledgeRisk) {
                throw new RiskWarningException(risk);
            }
            // Second factor for a transfer the system itself doubted: a code texted to the sender's own phone.
            otpService.verify(senderWallet.getUser(), OtpPurpose.TRANSFER, otpCode,
                    OtpService.transferContext(toPhone, amount));
        }

        // Cached balance columns are updated here; @Version on Wallet is what makes this
        // safe under concurrency — a losing concurrent writer gets ObjectOptimisticLockingFailureException
        // instead of silently clobbering this update, and @Retryable above re-runs the whole method.
        senderWallet.setBalance(senderWallet.getBalance().subtract(amount));
        recipientWallet.setBalance(recipientWallet.getBalance().add(amount));
        walletRepository.save(senderWallet);
        walletRepository.save(recipientWallet);

        Transaction txn = new Transaction(senderWallet, recipientWallet, amount, "SUCCESS");
        transactionRepository.saveAndFlush(txn);
        auditLogRepository.save(new AuditLog(txn, buildAuditDetail(senderWallet, recipientWallet, amount)));

        // Source-of-truth ledger rows, posted in the same DB transaction as everything above.
        ledgerService.postTransfer(txn, senderWallet, recipientWallet, amount);

        // Reliable "tell the outside world" hook: commits atomically with the transfer,
        // or rolls back with it. OutboxPublisher delivers it asynchronously afterwards.
        outboxEventRepository.save(new OutboxEvent(
                "Transaction", txn.getId(), "transfer.completed",
                writeJson(new TransactionResponse(txn.getId(), amount, toPhone,
                        senderWallet.getBalance(), txn.getCreatedAt(), TransactionStatus.SUCCESS, List.of()))));

        return new TransactionResponse(txn.getId(), amount, toPhone, senderWallet.getBalance(), txn.getCreatedAt(),
                TransactionStatus.SUCCESS, List.of());
    }

    /**
     * Records the transfer as waiting for review. No balance changes and no ledger rows: the money
     * stays with the sender until a reviewer releases it.
     */
    private TransactionResponse holdForReview(Wallet sender, Wallet receiver, String toPhone, BigDecimal amount,
                                              RiskAssessment risk) {
        Transaction txn = new Transaction(sender, receiver, amount, TransactionStatus.PENDING_REVIEW);
        transactionRepository.saveAndFlush(txn);
        String codes = risk.reasons().stream().map(r -> r.code()).collect(java.util.stream.Collectors.joining(","));
        auditLogRepository.save(new AuditLog(txn, "HELD score=" + risk.score() + " " + codes));

        TransactionResponse response = new TransactionResponse(txn.getId(), amount, toPhone, sender.getBalance(),
                txn.getCreatedAt(), TransactionStatus.PENDING_REVIEW, risk.reasons());
        outboxEventRepository.save(new OutboxEvent("Transaction", txn.getId(), "transfer.held", writeJson(response)));
        return response;
    }

    /** Texts the sender a code for one specific transfer; the code is useless for any other recipient or amount. */
    @Transactional
    public OtpSentResponse requestTransferCode(String senderUserId, String rawToPhone, BigDecimal amount) {
        String toPhone = normalizeRecipient(rawToPhone);
        User sender = userRepository.findById(senderUserId)
                .orElseThrow(() -> new WalletNotFoundException("Sender wallet not found"));
        otpService.requireVerifiedPhone(sender);
        return otpService.send(sender, OtpPurpose.TRANSFER, OtpService.transferContext(toPhone, amount));
    }

    /** Scores a transfer without doing it, so the app can show warnings before the sender confirms. */
    @Transactional(readOnly = true)
    public RiskAssessment assessRisk(String senderUserId, String rawToPhone, BigDecimal amount) {
        String toPhone = normalizeRecipient(rawToPhone);
        Wallet senderWallet = walletRepository.findByUserId(senderUserId)
                .orElseThrow(() -> new WalletNotFoundException("Sender wallet not found"));
        User recipientUser = userRepository.findByPhone(toPhone)
                .orElseThrow(() -> new WalletNotFoundException("Recipient not found"));
        Wallet recipientWallet = walletRepository.findByUserId(recipientUser.getId())
                .orElseThrow(() -> new WalletNotFoundException("Recipient wallet not found"));
        if (senderWallet.getId().equals(recipientWallet.getId())) {
            throw new InvalidTransferException("Cannot transfer to your own wallet");
        }
        return riskService.assess(senderWallet, recipientWallet, amount);
    }

    private static String normalizeRecipient(String rawToPhone) {
        try {
            return PhoneNumber.normalize(rawToPhone);
        } catch (IllegalArgumentException e) {
            throw new InvalidTransferException("Invalid recipient phone number");
        }
    }

    private String buildAuditDetail(Wallet sender, Wallet receiver, BigDecimal amount) {
        return "Transfer of Rs. " + amount + " from wallet " + sender.getId() + " to wallet " + receiver.getId();
    }

    public List<TransactionHistoryResponse> getHistory(String userId) {
        Wallet myWallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("Wallet not found"));

        return transactionRepository
                .findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(myWallet.getId(), myWallet.getId())
                .stream()
                // The receiver only sees a transfer once money has actually arrived.
                .filter(txn -> txn.getSender().getId().equals(myWallet.getId())
                        || TransactionStatus.SUCCESS.equals(txn.getStatus())
                        || TransactionStatus.REVERSED.equals(txn.getStatus())
                        || TransactionStatus.REVERSAL.equals(txn.getStatus()))
                .map(txn -> toHistoryResponse(txn, myWallet.getId()))
                .toList();
    }

    private TransactionHistoryResponse toHistoryResponse(Transaction txn, String myWalletId) {
        boolean sent = txn.getSender().getId().equals(myWalletId);
        Wallet counterpartyWallet = sent ? txn.getReceiver() : txn.getSender();
        return new TransactionHistoryResponse(
                txn.getId(),
                sent ? "SENT" : "RECEIVED",
                counterpartyWallet.getUser().getName(),
                counterpartyWallet.getUser().getPhone(),
                txn.getAmount(),
                txn.getCreatedAt(),
                txn.getStatus()
        );
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize response for idempotency/outbox storage", e);
        }
    }

    private TransactionResponse readCachedResponse(IdempotencyKey record) {
        try {
            return objectMapper.readValue(record.getResponseBody(), TransactionResponse.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupted cached idempotent response for key " + record.getId(), e);
        }
    }

}
