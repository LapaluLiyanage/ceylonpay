package lk.ceylonpay.controller;

import lk.ceylonpay.dto.UserLookupResponse;
import lk.ceylonpay.exception.InvalidTransferException;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.util.NameMask;
import lk.ceylonpay.util.PhoneNumber;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Name check: lets a sender see who a phone number belongs to before sending money. */
    @GetMapping("/lookup")
    public ResponseEntity<UserLookupResponse> lookup(@RequestParam("phone") String phone) {
        String normalized;
        try {
            normalized = PhoneNumber.normalize(phone);
        } catch (IllegalArgumentException e) {
            throw new InvalidTransferException("Invalid phone number");
        }
        return userRepository.findByPhone(normalized)
                .map(user -> ResponseEntity.ok(new UserLookupResponse(NameMask.mask(user.getName()), normalized)))
                .orElseThrow(() -> new WalletNotFoundException("Recipient not found"));
    }

}
