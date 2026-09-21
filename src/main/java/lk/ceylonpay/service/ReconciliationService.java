package lk.ceylonpay.service;

import lk.ceylonpay.entity.ReconciliationDiscrepancy;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.LedgerEntryRepository;
import lk.ceylonpay.repository.ReconciliationDiscrepancyRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Nightly (and on-demand) back-office check: does every wallet's cached
 * {@code balance} column still agree with the balance derived from its
 * ledger history? This is exactly what bank reconciliation jobs do —
 * balances are never assumed correct just because no error was thrown when
 * they were written; they're independently re-verified against the ledger
 * on a schedule.
 */
@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final ReconciliationDiscrepancyRepository discrepancyRepository;

    public ReconciliationService(WalletRepository walletRepository,
                                  LedgerEntryRepository ledgerEntryRepository,
                                  ReconciliationDiscrepancyRepository discrepancyRepository) {
        this.walletRepository = walletRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.discrepancyRepository = discrepancyRepository;
    }

    @Scheduled(cron = "${reconciliation.cron:0 0 2 * * *}") // default: every night at 2am
    @Transactional
    public List<ReconciliationDiscrepancy> reconcileAllWallets() {
        List<ReconciliationDiscrepancy> found = new java.util.ArrayList<>();
        for (Wallet wallet : walletRepository.findAll()) {
            BigDecimal cached = wallet.getBalance();
            BigDecimal fromLedger = ledgerEntryRepository.computeBalance(wallet.getId());
            if (cached.compareTo(fromLedger) != 0) {
                log.error("Reconciliation mismatch on wallet {}: cached={} ledger={}",
                        wallet.getId(), cached, fromLedger);
                found.add(discrepancyRepository.save(
                        new ReconciliationDiscrepancy(wallet.getId(), cached, fromLedger)));
            }
        }
        if (found.isEmpty()) {
            log.info("Reconciliation complete: all wallet balances match the ledger.");
        }
        return found;
    }

}
