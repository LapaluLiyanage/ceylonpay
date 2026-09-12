package lk.ceylonpay.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Placeholder for Part 3 (Wallet & Deposit) — exists in Part 2 purely so
 * SecurityConfig has a protected /api/wallet/** route to verify against.
 */
@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    @GetMapping("/ping")
    public Map<String, String> ping(Authentication authentication) {
        return Map.of("authenticatedUserId", authentication.getName());
    }

}
