package lk.ceylonpay.service;

import lk.ceylonpay.dto.BalanceResponse;
import lk.ceylonpay.entity.AuditLog;
import lk.ceylonpay.entity.OutboxEvent;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.Wallet;
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

@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final SystemAccountService systemAccountService;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;
    private final LedgerService ledgerService;
    private final OutboxEventRepository outboxEventRepository;

    public WalletService(WalletRepository walletRepository, SystemAccountService systemAccountService,
                          TransactionRepository transactionRepository, AuditLogRepository auditLogRepository,
                          LedgerService ledgerService, OutboxEventRepository outboxEventRepository) {
        this.walletRepository = walletRepository;
        this.systemAccountService = systemAccountService;
        this.transactionRepository = transactionRepository;
        this.auditLogRepository = auditLogRepository;
        this.ledgerService = ledgerService;
        this.outboxEventRepository = outboxEventRepository;
    }

    public BalanceResponse getBalance(String userId) {
        Wallet wallet = findWalletOrThrow(userId);
        return toResponse(wallet);
    }

    /**
     * A deposit is modeled as a transfer from the external funding wallet
     * (see {@link SystemAccountService}) into the user's wallet — not a
     * bare balance increment. That gives it the same two-sided ledger
     * entries, audit log row, and outbox event as a P2P transfer, so
     * "money in the system" is always traceable to a source, never
     * conjured by a single UPDATE statement.
     */
    @Retryable(
            retryFor = ObjectOptimisticLockingFailureException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 50, multiplier = 2)
    )
    @Transactional
    public BalanceResponse deposit(String userId, BigDecimal amount) {
        Wallet userWallet = findWalletOrThrow(userId);
        Wallet externalWallet = systemAccountService.getOrCreateExternalFundingWallet();

        // The external wallet's balance goes negative by design — it represents a running
        // liability (money CeylonPay has taken in from outside), not a spendable balance.
        externalWallet.setBalance(externalWallet.getBalance().subtract(amount));
        userWallet.setBalance(userWallet.getBalance().add(amount));
        walletRepository.save(externalWallet);
        Wallet savedUserWallet = walletRepository.save(userWallet);

        Transaction txn = new Transaction(externalWallet, userWallet, amount, "SUCCESS");
        transactionRepository.saveAndFlush(txn);
        auditLogRepository.save(new AuditLog(txn,
                "Deposit of Rs. " + amount + " into wallet " + userWallet.getId()));

        ledgerService.postTransfer(txn, externalWallet, userWallet, amount);

        outboxEventRepository.save(new OutboxEvent(
                "Transaction", txn.getId(), "deposit.completed",
                "{\"walletId\":\"" + userWallet.getId() + "\",\"amount\":" + amount + "}"));

        return toResponse(savedUserWallet);
    }

    private Wallet findWalletOrThrow(String userId) {
        return walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("No wallet found for this user"));
    }

    private BalanceResponse toResponse(Wallet wallet) {
        return new BalanceResponse(wallet.getId(), wallet.getBalance());
    }

}
