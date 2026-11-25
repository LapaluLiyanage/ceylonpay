package lk.ceylonpay.repository;

import lk.ceylonpay.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

    Optional<AuditLog> findByTransaction_Id(String transactionId);
}
