package lk.ceylonpay.config;

import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.util.PhoneNumber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Promotes the account whose phone is in {@code CEYLONPAY_ADMIN_PHONE} to the ADMIN role at startup.
 * Nobody can become an admin through the API; the operator chooses who, via configuration.
 * The user must already be registered.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final String adminPhone;

    public AdminBootstrap(UserRepository userRepository,
                          @Value("${CEYLONPAY_ADMIN_PHONE:}") String adminPhone) {
        this.userRepository = userRepository;
        this.adminPhone = adminPhone;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (adminPhone == null || adminPhone.isBlank()) {
            return;
        }
        if (!PhoneNumber.isValid(adminPhone)) {
            log.warn("CEYLONPAY_ADMIN_PHONE is not a valid Sri Lankan mobile number; ignoring");
            return;
        }
        userRepository.findByPhone(PhoneNumber.normalize(adminPhone)).ifPresentOrElse(user -> {
            if (!"ADMIN".equals(user.getRole())) {
                user.setRole("ADMIN");
                userRepository.save(user);
                log.info("Promoted configured admin account to ADMIN");
            }
        }, () -> log.warn("CEYLONPAY_ADMIN_PHONE does not match a registered user; register first, then restart"));
    }

}
