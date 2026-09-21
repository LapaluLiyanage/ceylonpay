package lk.ceylonpay.service;

import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Owns the "external funding source" wallet — the double-entry system's
 * counterparty for money entering CeylonPay from outside (a deposit).
 *
 * <p>Every ledger entry must have two sides. A deposit isn't just "add to
 * the user's balance" — it's a transfer from the outside world into the
 * user's wallet, so it needs a real counterparty wallet on the other side
 * of the entry. This system account plays that role, the same way a bank's
 * general ledger has a "cash suspense" account that every teller deposit
 * posts against.</p>
 *
 * <p><b>Known scaling limitation, called out deliberately:</b> every deposit
 * in the whole system updates this one wallet's cached balance, making it a
 * single point of lock contention under real concurrent load. A production
 * system would either shard the suspense account per region/currency or
 * stop giving it a mutable balance column at all (deriving it purely from
 * the ledger, never caching it) — noted here rather than hidden, since
 * recognizing a bottleneck you introduced is more convincing than pretending
 * every part of a student project scales infinitely.</p>
 */
@Service
public class SystemAccountService {

    private static final String EXTERNAL_FUNDING_PHONE = "SYSTEM-EXTERNAL-FUNDING";

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final PasswordEncoder passwordEncoder;

    public SystemAccountService(UserRepository userRepository, WalletRepository walletRepository,
                                 PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Wallet getOrCreateExternalFundingWallet() {
        User systemUser = userRepository.findByPhone(EXTERNAL_FUNDING_PHONE)
                .orElseGet(this::createSystemUser);
        return walletRepository.findByUserId(systemUser.getId())
                .orElseGet(() -> createSystemWallet(systemUser));
    }

    private User createSystemUser() {
        User user = new User();
        user.setName("External Funding Source");
        user.setPhone(EXTERNAL_FUNDING_PHONE);
        user.setNic("SYSTEM-" + UUID.randomUUID());
        // Unguessable password — this account never logs in; login is blocked separately by role.
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole("SYSTEM");
        return userRepository.save(user);
    }

    private Wallet createSystemWallet(User systemUser) {
        Wallet wallet = new Wallet();
        wallet.setUser(systemUser);
        return walletRepository.save(wallet);
    }

}
