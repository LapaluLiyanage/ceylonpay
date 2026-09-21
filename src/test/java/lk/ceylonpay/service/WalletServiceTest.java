package lk.ceylonpay.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.ceylonpay.dto.BalanceResponse;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.OutboxEventRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private SystemAccountService systemAccountService;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private LedgerService ledgerService;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private WalletService walletService;

    @Test
    void getBalanceReturnsTheWalletsCurrentBalance() {
        Wallet wallet = new Wallet();
        wallet.setId("wallet-1");
        wallet.setBalance(new BigDecimal("500.0000"));
        when(walletRepository.findByUserId("user-123")).thenReturn(Optional.of(wallet));

        BalanceResponse response = walletService.getBalance("user-123");

        assertThat(response.walletId()).isEqualTo("wallet-1");
        assertThat(response.balance()).isEqualByComparingTo("500.0000");
    }

    @Test
    void getBalanceThrowsWhenWalletMissing() {
        when(walletRepository.findByUserId("user-123")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> walletService.getBalance("user-123"))
                .isInstanceOf(WalletNotFoundException.class);
    }

    @Test
    void depositAddsAmountToExistingBalanceAndSaves() {
        Wallet wallet = new Wallet();
        wallet.setId("wallet-1");
        wallet.setBalance(new BigDecimal("100.0000"));
        Wallet externalWallet = new Wallet();
        externalWallet.setId("wallet-external");
        externalWallet.setBalance(BigDecimal.ZERO);

        when(walletRepository.findByUserId("user-123")).thenReturn(Optional.of(wallet));
        when(systemAccountService.getOrCreateExternalFundingWallet()).thenReturn(externalWallet);
        when(walletRepository.save(externalWallet)).thenReturn(externalWallet);
        when(walletRepository.save(wallet)).thenReturn(wallet);
        try {
            lenient().when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new AssertionError(e);
        }

        BalanceResponse response = walletService.deposit("user-123", new BigDecimal("50.00"));

        assertThat(response.balance()).isEqualByComparingTo("150.0000");
        verify(walletRepository).save(wallet);
        assertThat(wallet.getBalance()).isEqualByComparingTo("150.0000");
    }

    @Test
    void depositThrowsWhenWalletMissing() {
        when(walletRepository.findByUserId("user-123")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> walletService.deposit("user-123", new BigDecimal("50.00")))
                .isInstanceOf(WalletNotFoundException.class);
    }

}
