package lk.ceylonpay.service;

import lk.ceylonpay.dto.BalanceResponse;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.WalletRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class WalletService {

    private final WalletRepository walletRepository;

    public WalletService(WalletRepository walletRepository) {
        this.walletRepository = walletRepository;
    }

    public BalanceResponse getBalance(String userId) {
        Wallet wallet = findWalletOrThrow(userId);
        return toResponse(wallet);
    }

    public BalanceResponse deposit(String userId, BigDecimal amount) {
        Wallet wallet = findWalletOrThrow(userId);
        wallet.setBalance(wallet.getBalance().add(amount));
        Wallet saved = walletRepository.save(wallet);
        return toResponse(saved);
    }

    private Wallet findWalletOrThrow(String userId) {
        return walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("No wallet found for this user"));
    }

    private BalanceResponse toResponse(Wallet wallet) {
        return new BalanceResponse(wallet.getId(), wallet.getBalance());
    }

}
