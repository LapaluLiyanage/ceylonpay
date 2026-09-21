package lk.ceylonpay.repository;

import lk.ceylonpay.entity.ReconciliationDiscrepancy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReconciliationDiscrepancyRepository extends JpaRepository<ReconciliationDiscrepancy, String> {

    List<ReconciliationDiscrepancy> findByResolvedFalseOrderByDetectedAtDesc();

    Optional<ReconciliationDiscrepancy> findByWalletIdAndResolvedFalse(String walletId);

}
