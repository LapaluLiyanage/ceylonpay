package lk.ceylonpay.service;

import lk.ceylonpay.entity.LedgerEntry;
import lk.ceylonpay.entity.LedgerEntryType;
import lk.ceylonpay.entity.Transaction;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.LedgerEntryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * Posts double-entry ledger rows for a transfer.
 *
 * <p>A transfer of amount A from wallet S to wallet R always produces
 * exactly two {@link LedgerEntry} rows in the same database transaction:
 * a DEBIT of A on S, and a CREDIT of A on R. Every transfer's debits and
 * credits balance to zero across the ledger by construction — that
 * invariant is what makes the ledger trustworthy as a source of truth,
 * independent of whatever the cached {@code Wallet.balance} column says.</p>
 */
@Service
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;

    public LedgerService(LedgerEntryRepository ledgerEntryRepository) {
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    /** Posts the DEBIT/CREDIT pair for a completed transfer. Call this inside the same @Transactional method that saves the Transaction. */
    public void postTransfer(Transaction txn, Wallet sender, Wallet receiver, BigDecimal amount) {
        ledgerEntryRepository.save(
                new LedgerEntry(sender, txn, LedgerEntryType.DEBIT, amount, sender.getBalance()));
        ledgerEntryRepository.save(
                new LedgerEntry(receiver, txn, LedgerEntryType.CREDIT, amount, receiver.getBalance()));
    }

    /** Recomputes a wallet's true balance from its ledger history — ignores the cached {@code Wallet.balance} column entirely. */
    public BigDecimal computeTrueBalance(String walletId) {
        return ledgerEntryRepository.computeBalance(walletId);
    }

    /** Full, chronological, immutable ledger history for a wallet — this is what an audit or the reconciliation job would inspect. */
    public List<LedgerEntry> history(String walletId) {
        return ledgerEntryRepository.findByWallet_IdOrderByCreatedAtAsc(walletId);
    }

}
