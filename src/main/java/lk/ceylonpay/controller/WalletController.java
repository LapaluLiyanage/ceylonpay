package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.BalanceResponse;
import lk.ceylonpay.dto.DepositRequest;
import lk.ceylonpay.dto.LedgerEntryResponse;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.service.LedgerService;
import lk.ceylonpay.service.WalletService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final WalletRepository walletRepository;

    public WalletController(WalletService walletService, LedgerService ledgerService,
                             WalletRepository walletRepository) {
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.walletRepository = walletRepository;
    }

    @GetMapping("/balance")
    public ResponseEntity<BalanceResponse> getBalance(Authentication authentication) {
        return ResponseEntity.ok(walletService.getBalance(authentication.getName()));
    }

    @PostMapping("/deposit")
    public ResponseEntity<BalanceResponse> deposit(Authentication authentication,
                                                     @Valid @RequestBody DepositRequest request) {
        return ResponseEntity.ok(walletService.deposit(authentication.getName(), request.amount()));
    }

    /**
     * The double-entry ledger, in the caller's own words: every DEBIT/CREDIT
     * ever posted against their wallet, in order, each with the balance
     * snapshot right after it. This is what "show me the AI/engineering
     * feature working" looks like in a live demo — a transaction history
     * view derived straight from the immutable ledger rather than the
     * cached balance column.
     */
    @GetMapping("/ledger")
    public ResponseEntity<List<LedgerEntryResponse>> getLedger(Authentication authentication) {
        Wallet wallet = walletRepository.findByUserId(authentication.getName())
                .orElseThrow(() -> new WalletNotFoundException("No wallet found for this user"));

        List<LedgerEntryResponse> response = ledgerService.history(wallet.getId()).stream()
                .map(entry -> new LedgerEntryResponse(
                        entry.getId(), entry.getTransaction().getId(), entry.getEntryType(),
                        entry.getAmount(), entry.getBalanceAfter(), entry.getCreatedAt()))
                .toList();

        return ResponseEntity.ok(response);
    }

}
