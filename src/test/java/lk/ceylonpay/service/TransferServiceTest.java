package lk.ceylonpay.service;

import lk.ceylonpay.dto.TransactionHistoryResponse;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InsufficientBalanceException;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.AuditLogRepository;
import lk.ceylonpay.repository.TransactionRepository;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @InjectMocks
    private TransferService transferService;

    private Wallet walletWithBalance(String id, String userId, String balance) {
        Wallet wallet = new Wallet();
        wallet.setId(id);
        User user = new User();
        user.setId(userId);
        wallet.setUser(user);
        wallet.setBalance(new BigDecimal(balance));
        return wallet;
    }

    @Test
    void transfer_shouldSucceed_whenBalanceSufficient() {
        Wallet senderWallet = walletWithBalance("wallet-sender", "user-sender", "500.0000");
        Wallet recipientWallet = walletWithBalance("wallet-recipient", "user-recipient", "100.0000");
        User recipientUser = recipientWallet.getUser();
        recipientUser.setPhone("0722222222");

        when(walletRepository.findByUserId("user-sender")).thenReturn(Optional.of(senderWallet));
        when(userRepository.findByPhone("0722222222")).thenReturn(Optional.of(recipientUser));
        when(walletRepository.findByUserId("user-recipient")).thenReturn(Optional.of(recipientWallet));

        TransactionResponse response =
                transferService.transfer("user-sender", "0722222222", new BigDecimal("200.00"));

        assertThat(senderWallet.getBalance()).isEqualByComparingTo("300.0000");
        assertThat(recipientWallet.getBalance()).isEqualByComparingTo("300.0000");
        assertThat(response.recipientPhone()).isEqualTo("0722222222");
        assertThat(response.amount()).isEqualByComparingTo("200.00");
        assertThat(response.newBalance()).isEqualByComparingTo("300.0000");

        verify(walletRepository).save(senderWallet);
        verify(walletRepository).save(recipientWallet);
        verify(transactionRepository).saveAndFlush(any());
        verify(auditLogRepository).save(any());
    }

    @Test
    void transfer_shouldThrow_whenBalanceInsufficient() {
        Wallet senderWallet = walletWithBalance("wallet-sender", "user-sender", "100.0000");
        Wallet recipientWallet = walletWithBalance("wallet-recipient", "user-recipient", "50.0000");
        User recipientUser = recipientWallet.getUser();
        recipientUser.setPhone("0722222222");

        when(walletRepository.findByUserId("user-sender")).thenReturn(Optional.of(senderWallet));
        when(userRepository.findByPhone("0722222222")).thenReturn(Optional.of(recipientUser));
        when(walletRepository.findByUserId("user-recipient")).thenReturn(Optional.of(recipientWallet));

        assertThatThrownBy(() ->
                transferService.transfer("user-sender", "0722222222", new BigDecimal("200.00")))
                .isInstanceOf(InsufficientBalanceException.class);

        assertThat(senderWallet.getBalance()).isEqualByComparingTo("100.0000");
        assertThat(recipientWallet.getBalance()).isEqualByComparingTo("50.0000");
        verify(walletRepository, never()).save(any());
        verify(transactionRepository, never()).saveAndFlush(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void transfer_shouldThrow_whenRecipientNotFound() {
        Wallet senderWallet = walletWithBalance("wallet-sender", "user-sender", "500.0000");
        when(walletRepository.findByUserId("user-sender")).thenReturn(Optional.of(senderWallet));
        when(userRepository.findByPhone("0799999999")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                transferService.transfer("user-sender", "0799999999", new BigDecimal("50.00")))
                .isInstanceOf(WalletNotFoundException.class);

        verify(walletRepository, never()).save(any());
        verify(transactionRepository, never()).saveAndFlush(any());
    }

    @Test
    void transfer_shouldThrow_whenTransferringToSelf() {
        Wallet senderWallet = walletWithBalance("wallet-sender", "user-sender", "500.0000");
        User senderUser = senderWallet.getUser();
        senderUser.setPhone("0711111111");

        when(walletRepository.findByUserId("user-sender")).thenReturn(Optional.of(senderWallet));
        when(userRepository.findByPhone("0711111111")).thenReturn(Optional.of(senderUser));

        assertThatThrownBy(() ->
                transferService.transfer("user-sender", "0711111111", new BigDecimal("50.00")))
                .isInstanceOf(InvalidTransferException.class);

        verify(walletRepository, never()).save(any());
    }

    @Test
    void getHistoryReturnsEmptyListWhenNoTransactions() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of());

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).isEmpty();
    }

    @Test
    void getHistoryLabelsATransactionAsSentWhenMyWalletIsTheSender() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        Wallet theirWallet = walletWithBalance("wallet-theirs", "user-theirs", "50.0000");
        theirWallet.getUser().setName("Recipient F");
        theirWallet.getUser().setPhone("0799999998");

        lk.ceylonpay.entity.Transaction txn = new lk.ceylonpay.entity.Transaction(
                myWallet, theirWallet, new BigDecimal("200.00"), "SUCCESS");
        txn.setId("txn-1");

        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of(txn));

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).hasSize(1);
        assertThat(history.get(0).direction()).isEqualTo("SENT");
        assertThat(history.get(0).counterpartyName()).isEqualTo("Recipient F");
        assertThat(history.get(0).counterpartyPhone()).isEqualTo("0799999998");
        assertThat(history.get(0).amount()).isEqualByComparingTo("200.00");
    }

    @Test
    void getHistoryLabelsATransactionAsReceivedWhenMyWalletIsTheReceiver() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        Wallet theirWallet = walletWithBalance("wallet-theirs", "user-theirs", "50.0000");
        theirWallet.getUser().setName("Sender C");
        theirWallet.getUser().setPhone("0733333333");

        lk.ceylonpay.entity.Transaction txn = new lk.ceylonpay.entity.Transaction(
                theirWallet, myWallet, new BigDecimal("75.00"), "SUCCESS");
        txn.setId("txn-2");

        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of(txn));

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).hasSize(1);
        assertThat(history.get(0).direction()).isEqualTo("RECEIVED");
        assertThat(history.get(0).counterpartyName()).isEqualTo("Sender C");
        assertThat(history.get(0).counterpartyPhone()).isEqualTo("0733333333");
    }

}
