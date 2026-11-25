package lk.ceylonpay.service;

import lk.ceylonpay.dto.AuthResponse;
import lk.ceylonpay.dto.LoginRequest;
import lk.ceylonpay.dto.RegisterRequest;
import lk.ceylonpay.dto.OtpSentResponse;
import lk.ceylonpay.entity.OtpPurpose;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InvalidCredentialsException;
import lk.ceylonpay.exception.UserAlreadyExistsException;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.security.JwtUtil;
import lk.ceylonpay.util.PhoneNumber;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final WalletRepository walletRepository;
    private final RefreshTokenService refreshTokenService;
    private final OtpService otpService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                        WalletRepository walletRepository, RefreshTokenService refreshTokenService,
                        OtpService otpService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.walletRepository = walletRepository;
        this.refreshTokenService = refreshTokenService;
        this.otpService = otpService;
    }

    public AuthResponse register(RegisterRequest request) {
        String phone = PhoneNumber.normalize(request.phone());
        if (userRepository.findByPhone(phone).isPresent()) {
            throw new UserAlreadyExistsException("Phone number already registered");
        }
        if (userRepository.findByNic(request.nic()).isPresent()) {
            throw new UserAlreadyExistsException("NIC already registered");
        }

        User user = new User();
        user.setName(request.name());
        user.setPhone(phone);
        user.setNic(request.nic());
        user.setPassword(passwordEncoder.encode(request.password()));
        // With codes switched off there is nothing to verify against, so the account counts as verified.
        user.setPhoneVerified(!otpService.isEnabled());

        User saved = userRepository.save(user);

        Wallet wallet = new Wallet();
        wallet.setUser(saved);
        wallet.setBalance(BigDecimal.ZERO);
        walletRepository.save(wallet);

        if (!saved.isPhoneVerified()) {
            otpService.send(saved, OtpPurpose.REGISTER, null);
        }

        String token = jwtUtil.generateToken(saved.getId(), saved.getRole());

        return new AuthResponse(token, saved.getId(), saved.getName(), saved.getRole(),
                refreshTokenService.startSession(saved.getId()), saved.isPhoneVerified());
    }

    public AuthResponse login(LoginRequest request) {
        if (!PhoneNumber.isValid(request.phone())) {
            throw new InvalidCredentialsException("Invalid phone number or password");
        }
        User user = userRepository.findByPhone(PhoneNumber.normalize(request.phone()))
                .orElseThrow(() -> new InvalidCredentialsException("Invalid phone number or password"));

        // Defense in depth: the system/suspense account (see SystemAccountService) has no real
        // password anyone knows, but this makes it explicit that it must never be able to log in.
        if (!"USER".equals(user.getRole()) && !"ADMIN".equals(user.getRole())) {
            throw new InvalidCredentialsException("Invalid phone number or password");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new InvalidCredentialsException("Invalid phone number or password");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole());
        return new AuthResponse(token, user.getId(), user.getName(), user.getRole(),
                refreshTokenService.startSession(user.getId()), user.isPhoneVerified());
    }

    /** Swaps a valid refresh token for a fresh access token and the next refresh token. */
    public AuthResponse refresh(String refreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
        // Re-read the user so a changed role (or a removed account) takes effect at the next refresh.
        User user = userRepository.findById(rotation.userId())
                .filter(u -> "USER".equals(u.getRole()) || "ADMIN".equals(u.getRole()))
                .orElseThrow(() -> new InvalidCredentialsException("Invalid refresh token"));
        return new AuthResponse(jwtUtil.generateToken(user.getId(), user.getRole()), user.getId(), user.getName(),
                user.getRole(), rotation.newRefreshToken(), user.isPhoneVerified());
    }

    public OtpSentResponse requestPhoneCode(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid session"));
        if (user.isPhoneVerified()) {
            return new OtpSentResponse(false, null);
        }
        return otpService.send(user, OtpPurpose.REGISTER, null);
    }

    public void verifyPhone(String userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid session"));
        otpService.verify(user, OtpPurpose.REGISTER, code, null);
        user.setPhoneVerified(true);
        userRepository.save(user);
    }

    public void logout(String refreshToken) {
        refreshTokenService.revokeSession(refreshToken);
    }

}
