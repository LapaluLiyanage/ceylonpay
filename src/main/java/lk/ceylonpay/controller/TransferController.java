package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.dto.TransferRequest;
import lk.ceylonpay.dto.ScamReportRequest;
import lk.ceylonpay.dto.ScamReportResponse;
import lk.ceylonpay.service.HeldTransferService;
import lk.ceylonpay.service.ScamReportService;
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
    private final ScamReportService scamReportService;

    public TransferController(TransferService transferService, HeldTransferService heldTransferService,
                              ScamReportService scamReportService) {
        this.transferService = transferService;
        this.heldTransferService = heldTransferService;
        this.scamReportService = scamReportService;
    }

    /** "This was a scam": the sender reports a completed transfer; the receiver's outgoing money is put on hold. */
    @PostMapping("/{id}/report")
    public ResponseEntity<ScamReportResponse> report(Authentication authentication, @PathVariable String id,
                                                     @Valid @RequestBody(required = false) ScamReportRequest request) {
        String note = request == null ? null : request.note();
        return ResponseEntity.ok(scamReportService.report(authentication.getName(), id, note));
    }

    /** Texts the sender a one-time code for this transfer (needed when it carries a risk warning). */
    @PostMapping("/otp")
    public ResponseEntity<lk.ceylonpay.dto.OtpSentResponse> requestCode(Authentication authentication,
                                                                        @Valid @RequestBody RiskCheckRequest request) {
        return ResponseEntity.ok(transferService.requestTransferCode(authentication.getName(), request.toPhone(),
                request.amount()));
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
                        Boolean.TRUE.equals(request.acknowledgeRisk()), request.otpCode())
                : transferService.transfer(authentication.getName(), request.toPhone(), request.amount(),
                        Boolean.TRUE.equals(request.acknowledgeRisk()), request.otpCode());

        return ResponseEntity.ok(response);
    }

}
