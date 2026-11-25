package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.SafetySettingsRequest;
import lk.ceylonpay.dto.SafetySettingsResponse;
import lk.ceylonpay.service.SafetyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/safety")
public class SafetyController {

    private final SafetyService safetyService;

    public SafetyController(SafetyService safetyService) {
        this.safetyService = safetyService;
    }

    @GetMapping
    public ResponseEntity<SafetySettingsResponse> get(Authentication authentication) {
        return ResponseEntity.ok(safetyService.get(authentication.getName()));
    }

    @PutMapping
    public ResponseEntity<SafetySettingsResponse> update(Authentication authentication,
                                                         @Valid @RequestBody SafetySettingsRequest request) {
        return ResponseEntity.ok(safetyService.update(authentication.getName(), request));
    }

}
