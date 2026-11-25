package lk.ceylonpay.controller;

import lk.ceylonpay.dto.ReconciliationResponse;
import lk.ceylonpay.repository.ReconciliationDiscrepancyRepository;
import lk.ceylonpay.service.ReconciliationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Back-office view onto the reconciliation job. Access is restricted to the
 * ADMIN role in {@code SecurityConfig} ({@code /api/admin/**}).
 */
@RestController
@RequestMapping("/api/admin/reconciliation")
public class AdminController {

    private final ReconciliationService reconciliationService;
    private final ReconciliationDiscrepancyRepository discrepancyRepository;

    public AdminController(ReconciliationService reconciliationService,
                            ReconciliationDiscrepancyRepository discrepancyRepository) {
        this.reconciliationService = reconciliationService;
        this.discrepancyRepository = discrepancyRepository;
    }

    /** Unresolved balance discrepancies found by the nightly job so far. */
    @GetMapping
    public ResponseEntity<List<ReconciliationResponse>> getDiscrepancies() {
        List<ReconciliationResponse> response = discrepancyRepository.findByResolvedFalseOrderByDetectedAtDesc()
                .stream()
                .map(d -> new ReconciliationResponse(d.getWalletId(), d.getCachedBalance(), d.getLedgerBalance(), d.getDetectedAt()))
                .toList();
        return ResponseEntity.ok(response);
    }

    /** Runs the reconciliation check immediately instead of waiting for the 2am schedule — useful for a live demo. */
    @PostMapping("/run")
    public ResponseEntity<List<ReconciliationResponse>> runNow() {
        List<ReconciliationResponse> response = reconciliationService.reconcileAllWallets().stream()
                .map(d -> new ReconciliationResponse(d.getWalletId(), d.getCachedBalance(), d.getLedgerBalance(), d.getDetectedAt()))
                .toList();
        return ResponseEntity.ok(response);
    }

}
