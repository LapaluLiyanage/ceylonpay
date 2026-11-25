package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.ResolveReportRequest;
import lk.ceylonpay.dto.ScamReportResponse;
import lk.ceylonpay.entity.ScamReportStatus;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.service.ScamReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Scam report queue. ADMIN only (see {@code SecurityConfig}). */
@RestController
@RequestMapping("/api/admin/reports")
public class AdminReportController {

    private final ScamReportService scamReportService;

    public AdminReportController(ScamReportService scamReportService) {
        this.scamReportService = scamReportService;
    }

    @GetMapping
    public ResponseEntity<List<ScamReportResponse>> list(@RequestParam(defaultValue = "OPEN") String status) {
        try {
            return ResponseEntity.ok(scamReportService.list(ScamReportStatus.valueOf(status.toUpperCase())));
        } catch (IllegalArgumentException e) {
            throw new InvalidTransferException("Unknown status");
        }
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ScamReportResponse> resolve(Authentication authentication, @PathVariable String id,
                                                      @Valid @RequestBody ResolveReportRequest request) {
        boolean uphold = switch (request.decision().toUpperCase()) {
            case "UPHOLD" -> true;
            case "DISMISS" -> false;
            default -> throw new InvalidTransferException("Decision must be UPHOLD or DISMISS");
        };
        return ResponseEntity.ok(scamReportService.resolve(id, uphold, authentication.getName()));
    }

}
