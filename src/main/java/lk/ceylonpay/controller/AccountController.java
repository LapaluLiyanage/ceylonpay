package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.OtpSentResponse;
import lk.ceylonpay.dto.OtpVerifyRequest;
import lk.ceylonpay.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Phone verification for the signed-in user. */
@RestController
@RequestMapping("/api/account/phone")
public class AccountController {

    private final AuthService authService;

    public AccountController(AuthService authService) {
        this.authService = authService;
    }

    /** Sends (or re-sends) a code to the user's own phone number. */
    @PostMapping("/request")
    public ResponseEntity<OtpSentResponse> requestCode(Authentication authentication) {
        return ResponseEntity.ok(authService.requestPhoneCode(authentication.getName()));
    }

    @PostMapping("/verify")
    public ResponseEntity<Void> verify(Authentication authentication, @Valid @RequestBody OtpVerifyRequest request) {
        authService.verifyPhone(authentication.getName(), request.code());
        return ResponseEntity.noContent().build();
    }

}
