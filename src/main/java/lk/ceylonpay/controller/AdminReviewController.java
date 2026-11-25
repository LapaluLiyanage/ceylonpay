package lk.ceylonpay.controller;

import lk.ceylonpay.dto.HeldTransferResponse;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.service.HeldTransferService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Review queue for transfers held by the scam check. ADMIN only (see {@code SecurityConfig}). */
@RestController
@RequestMapping("/api/admin/reviews")
public class AdminReviewController {

    private final HeldTransferService heldTransferService;

    public AdminReviewController(HeldTransferService heldTransferService) {
        this.heldTransferService = heldTransferService;
    }

    @GetMapping
    public ResponseEntity<List<HeldTransferResponse>> pending() {
        return ResponseEntity.ok(heldTransferService.listPending());
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<TransactionResponse> approve(Authentication authentication, @PathVariable String id) {
        return ResponseEntity.ok(heldTransferService.approve(id, authentication.getName()));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> reject(Authentication authentication, @PathVariable String id) {
        heldTransferService.reject(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

}
