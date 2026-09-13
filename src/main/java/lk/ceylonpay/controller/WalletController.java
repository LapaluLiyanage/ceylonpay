package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.BalanceResponse;
import lk.ceylonpay.dto.DepositRequest;
import lk.ceylonpay.service.WalletService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
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

}
