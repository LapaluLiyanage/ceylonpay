package lk.ceylonpay.controller;

import lk.ceylonpay.dto.MuleSuspectResponse;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.risk.MuleDetectionService;
import lk.ceylonpay.service.SafetyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Suspected mule accounts and the manual hold an admin can put on them. ADMIN only. */
@RestController
@RequestMapping("/api/admin/mules")
public class AdminMuleController {

    private final MuleDetectionService muleDetectionService;
    private final SafetyService safetyService;
    private final UserRepository userRepository;

    public AdminMuleController(MuleDetectionService muleDetectionService, SafetyService safetyService,
                               UserRepository userRepository) {
        this.muleDetectionService = muleDetectionService;
        this.safetyService = safetyService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<MuleSuspectResponse>> suspects(@RequestParam(defaultValue = "24") int hours) {
        return ResponseEntity.ok(muleDetectionService.findSuspects(hours));
    }

    /** Stops the account sending money out; it can still receive. */
    @PostMapping("/{userId}/hold")
    public ResponseEntity<Void> hold(@PathVariable String userId) {
        requireUser(userId);
        safetyService.setReviewHold(userId, true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/release")
    public ResponseEntity<Void> release(@PathVariable String userId) {
        requireUser(userId);
        safetyService.setReviewHold(userId, false);
        return ResponseEntity.noContent().build();
    }

    private void requireUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new WalletNotFoundException("User not found");
        }
    }

}
