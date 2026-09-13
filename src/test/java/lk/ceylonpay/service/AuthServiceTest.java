package lk.ceylonpay.service;

import lk.ceylonpay.dto.AuthResponse;
import lk.ceylonpay.dto.LoginRequest;
import lk.ceylonpay.dto.RegisterRequest;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.entity.Wallet;
import lk.ceylonpay.exception.InvalidCredentialsException;
import lk.ceylonpay.exception.UserAlreadyExistsException;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.repository.WalletRepository;
import lk.ceylonpay.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private WalletRepository walletRepository;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerSavesHashedPasswordAndReturnsTokenAndName() {
        RegisterRequest request = new RegisterRequest("Nimal Perera", "0771234567", "991234567V", "raw-password");

        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.empty());
        when(userRepository.findByNic("991234567V")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("raw-password")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId("user-123");
            return saved;
        });
        when(jwtUtil.generateToken("user-123")).thenReturn("jwt-token");

        AuthResponse response = authService.register(request);

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.userId()).isEqualTo("user-123");
        assertThat(response.name()).isEqualTo("Nimal Perera");
        verify(userRepository).save(argThat(user -> user.getPassword().equals("hashed-password")));
    }

    @Test
    void registerCreatesAZeroBalanceWalletForTheNewUser() {
        RegisterRequest request = new RegisterRequest("Nimal Perera", "0771234567", "991234567V", "raw-password");

        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.empty());
        when(userRepository.findByNic("991234567V")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("raw-password")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId("user-123");
            return saved;
        });
        when(jwtUtil.generateToken("user-123")).thenReturn("jwt-token");

        authService.register(request);

        verify(walletRepository).save(argThat(wallet ->
                wallet.getUser().getId().equals("user-123")
                        && wallet.getBalance().compareTo(java.math.BigDecimal.ZERO) == 0));
    }

    @Test
    void registerThrowsWhenPhoneAlreadyTaken() {
        RegisterRequest request = new RegisterRequest("Nimal Perera", "0771234567", "991234567V", "raw-password");
        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(UserAlreadyExistsException.class);
    }

    @Test
    void registerThrowsWhenNicAlreadyTaken() {
        RegisterRequest request = new RegisterRequest("Nimal Perera", "0771234567", "991234567V", "raw-password");
        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.empty());
        when(userRepository.findByNic("991234567V")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(UserAlreadyExistsException.class);
    }

    @Test
    void loginReturnsTokenWhenCredentialsAreValid() {
        LoginRequest request = new LoginRequest("0771234567", "raw-password");
        User existing = new User();
        existing.setId("user-123");
        existing.setName("Nimal Perera");
        existing.setPassword("hashed-password");
        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("raw-password", "hashed-password")).thenReturn(true);
        when(jwtUtil.generateToken("user-123")).thenReturn("jwt-token");

        AuthResponse response = authService.login(request);

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.userId()).isEqualTo("user-123");
        assertThat(response.name()).isEqualTo("Nimal Perera");
    }

    @Test
    void loginThrowsWhenPhoneNotFound() {
        LoginRequest request = new LoginRequest("0771234567", "raw-password");
        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void loginThrowsWhenPasswordDoesNotMatch() {
        LoginRequest request = new LoginRequest("0771234567", "wrong-password");
        User existing = new User();
        existing.setId("user-123");
        existing.setPassword("hashed-password");
        when(userRepository.findByPhone("0771234567")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class);
    }

}
