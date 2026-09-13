package lk.ceylonpay.service;

import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.entity.AuditLog;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InsufficientBalanceException;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class TransferService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;

    public TransferService(UserRepository userRepository, WalletRepository walletRepository,
                            TransactionRepository transactionRepository, AuditLogRepository auditLogRepository) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public TransactionResponse transfer(String senderUserId, String toPhone, BigDecimal amount) {
        Wallet senderWallet = walletRepository.findByUserId(senderUserId)
                .orElseThrow(() -> new WalletNotFoundException("Sender wallet not found"));

        User recipientUser = userRepository.findByPhone(toPhone)
                .orElseThrow(() -> new WalletNotFoundException("Recipient not found"));
        Wallet recipientWallet = walletRepository.findByUserId(recipientUser.getId())
                .orElseThrow(() -> new WalletNotFoundException("Recipient wallet not found"));

        if (senderWallet.getId().equals(recipientWallet.getId())) {
            throw new InvalidTransferException("Cannot transfer to your own wallet");
        }
        if (senderWallet.getBalance().compareTo(amount) < 0) {
            throw new InsufficientBalanceException("Insufficient balance");
        }

        senderWallet.setBalance(senderWallet.getBalance().subtract(amount));
        recipientWallet.setBalance(recipientWallet.getBalance().add(amount));
        walletRepository.save(senderWallet);
        walletRepository.save(recipientWallet);

        Transaction txn = new Transaction(senderWallet, recipientWallet, amount, "SUCCESS");
        transactionRepository.saveAndFlush(txn);
        auditLogRepository.save(new AuditLog(txn, buildAuditDetail(senderWallet, recipientWallet, amount)));

        return new TransactionResponse(txn.getId(), amount, toPhone, senderWallet.getBalance(), txn.getCreatedAt());
    }

    private String buildAuditDetail(Wallet sender, Wallet receiver, BigDecimal amount) {
        return "Transfer of Rs. " + amount + " from wallet " + sender.getId() + " to wallet " + receiver.getId();
    }

}
