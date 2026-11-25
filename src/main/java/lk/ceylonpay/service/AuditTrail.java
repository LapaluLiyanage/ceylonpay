package lk.ceylonpay.service;

import lk.ceylonpay.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

/** Appends notes to a transaction's audit row as it moves through review (the column is 255 characters). */
@Service
public class AuditTrail {

    private static final int MAX = 255;

    private final AuditLogRepository auditLogRepository;

    public AuditTrail(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void append(String transactionId, String note) {
        auditLogRepository.findByTransaction_Id(transactionId).ifPresent(audit -> {
            String detail = audit.getDetail() + " | " + note;
            audit.setDetail(detail.length() > MAX ? detail.substring(0, MAX) : detail);
            auditLogRepository.save(audit);
        });
    }

}
