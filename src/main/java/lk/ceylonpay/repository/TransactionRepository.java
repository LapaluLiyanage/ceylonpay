package lk.ceylonpay.repository;

import lk.ceylonpay.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(String senderWalletId, String receiverWalletId);

}
