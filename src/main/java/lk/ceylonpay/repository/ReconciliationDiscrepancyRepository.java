package lk.ceylonpay.repository;

import lk.ceylonpay.entity.ReconciliationDiscrepancy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReconciliationDiscrepancyRepository extends JpaRepository<ReconciliationDiscrepancy, String> {

    List<ReconciliationDiscrepancy> findByResolvedFalseOrderByDetectedAtDesc();

}
