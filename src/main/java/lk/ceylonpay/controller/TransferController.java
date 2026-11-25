package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.dto.TransferRequest;
import lk.ceylonpay.service.HeldTransferService;
import lk.ceylonpay.service.TransferService;
import lk.ceylonpay.dto.RiskCheckRequest;
import lk.ceylonpay.risk.RiskAssessment;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    private final TransferService transferService;
    private final HeldTransferService heldTransferService;

    public TransferController(TransferService transferService, HeldTransferService heldTransferService) {
        this.transferService = transferService;
        this.heldTransferService = heldTransferService;
    }

    /** Scam check preview: score and reasons for a transfer that has not been sent. */
    @PostMapping("/risk-check")
    public ResponseEntity<RiskAssessment> riskCheck(Authentication authentication,
                                                    @Valid @RequestBody RiskCheckRequest request) {
        return ResponseEntity.ok(transferService.assessRisk(authentication.getName(), request.toPhone(), request.amount()));
    }

    /** The sender withdraws a transfer that is being held for review. */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(Authentication authentication, @PathVariable String id) {
        heldTransferService.cancel(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> transfer(
            Authentication authentication,
            @Valid @RequestBody TransferRequest request,
            @RequestHeader(name = "Idempotency-Key", required = false) @Nullable String idempotencyKey) {

        TransactionResponse response = (idempotencyKey != null && !idempotencyKey.isBlank())
                ? transferService.transferIdempotent(idempotencyKey, authentication.getName(), request.toPhone(), request.amount(),
                        Boolean.TRUE.equals(request.acknowledgeRisk()))
                : transferService.transfer(authentication.getName(), request.toPhone(), request.amount(),
                        Boolean.TRUE.equals(request.acknowledgeRisk()));

        return ResponseEntity.ok(response);
    }

}
