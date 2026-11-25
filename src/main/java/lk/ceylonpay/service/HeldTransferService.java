package lk.ceylonpay.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.dto.HeldTransferResponse;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.entity.AuditLog;
import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.TransactionStatus;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InsufficientBalanceException;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.OutboxEventRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Life of a transfer that the scam check held: no money moves while it waits, then a reviewer
 * approves it (money moves now, through the normal ledger path) or rejects it, or the sender
 * cancels it. Only {@code PENDING_REVIEW} transfers can change state, and each only once.
 */
@Service
public class HeldTransferService {

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditTrail auditTrail;
    private final OutboxEventRepository outboxEventRepository;
    private final LedgerService ledgerService;
    private final SafetyService safetyService;
    private final ObjectMapper objectMapper;

    public HeldTransferService(TransactionRepository transactionRepository, WalletRepository walletRepository,
                               AuditLogRepository auditLogRepository, AuditTrail auditTrail, OutboxEventRepository outboxEventRepository,
                               LedgerService ledgerService, SafetyService safetyService, ObjectMapper objectMapper) {
        this.transactionRepository = transactionRepository;
        this.walletRepository = walletRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditTrail = auditTrail;
        this.outboxEventRepository = outboxEventRepository;
        this.ledgerService = ledgerService;
        this.safetyService = safetyService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<HeldTransferResponse> listPending() {
        return transactionRepository.findByStatusOrderByCreatedAtAsc(TransactionStatus.PENDING_REVIEW).stream()
                .map(txn -> new HeldTransferResponse(
                        txn.getId(),
                        txn.getSender().getUser().getName(),
                        txn.getSender().getUser().getPhone(),
                        txn.getReceiver().getUser().getName(),
                        txn.getReceiver().getUser().getPhone(),
                        txn.getAmount(),
                        txn.getCreatedAt(),
                        auditLogRepository.findByTransaction_Id(txn.getId()).map(AuditLog::getDetail).orElse("")))
                .toList();
    }

    /** Moves the money for a held transfer, re-checking everything that may have changed while it waited. */
    @Retryable(
            retryFor = ObjectOptimisticLockingFailureException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 50, multiplier = 2)
    )
    @Transactional
    public TransactionResponse approve(String transactionId, String reviewerId) {
        Transaction txn = pending(transactionId);
        Wallet sender = txn.getSender();
        Wallet receiver = txn.getReceiver();
        BigDecimal amount = txn.getAmount();

        if (safetyService.isFrozen(sender.getUser().getId())) {
            throw new InvalidTransferException("The sender has frozen their wallet, so this transfer cannot be released");
        }
        if (sender.getBalance().compareTo(amount) < 0) {
            throw new InsufficientBalanceException("The sender no longer has enough balance for this transfer");
        }

        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));
        walletRepository.save(sender);
        walletRepository.save(receiver);

        txn.setStatus(TransactionStatus.SUCCESS);
        transactionRepository.saveAndFlush(txn);
        ledgerService.postTransfer(txn, sender, receiver, amount);
        auditTrail.append(txn.getId(), "APPROVED by " + reviewerId);

        TransactionResponse response = new TransactionResponse(txn.getId(), amount,
                receiver.getUser().getPhone(), sender.getBalance(), txn.getCreatedAt(),
                TransactionStatus.SUCCESS, List.of());
        outboxEventRepository.save(new OutboxEvent("Transaction", txn.getId(), "transfer.completed", writeJson(response)));
        return response;
    }

    @Transactional
    public void reject(String transactionId, String reviewerId) {
        Transaction txn = pending(transactionId);
        txn.setStatus(TransactionStatus.REJECTED);
        transactionRepository.save(txn);
        auditTrail.append(txn.getId(), "REJECTED by " + reviewerId);
        outboxEventRepository.save(new OutboxEvent("Transaction", txn.getId(), "transfer.rejected", "{}"));
    }

    /** The sender withdraws their own held transfer. */
    @Transactional
    public void cancel(String transactionId, String senderUserId) {
        Transaction txn = pending(transactionId);
        if (!txn.getSender().getUser().getId().equals(senderUserId)) {
            // Same answer as "doesn't exist" so ids of other people's transfers can't be probed.
            throw new WalletNotFoundException("Transfer not found");
        }
        txn.setStatus(TransactionStatus.CANCELLED);
        transactionRepository.save(txn);
        auditTrail.append(txn.getId(), "CANCELLED by sender");
        outboxEventRepository.save(new OutboxEvent("Transaction", txn.getId(), "transfer.cancelled", "{}"));
    }

    private Transaction pending(String transactionId) {
        Transaction txn = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new WalletNotFoundException("Transfer not found"));
        if (!TransactionStatus.PENDING_REVIEW.equals(txn.getStatus())) {
            throw new InvalidTransferException("This transfer is not waiting for review");
        }
        return txn;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize outbox payload", e);
        }
    }

}
