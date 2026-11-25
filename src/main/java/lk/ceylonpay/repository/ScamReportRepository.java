package lk.ceylonpay.repository;

import lk.ceylonpay.entity.ScamReport;
import lk.ceylonpay.entity.ScamReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ScamReportRepository extends JpaRepository<ScamReport, String> {

    Optional<ScamReport> findByTransaction_Id(String transactionId);

    List<ScamReport> findByStatusOrderByCreatedAtAsc(ScamReportStatus status);

    @Query("select count(r) from ScamReport r where r.transaction.receiver.id = :walletId and r.status = :status")
    long countAgainstReceiver(@Param("walletId") String walletId, @Param("status") ScamReportStatus status);

}
