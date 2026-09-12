package lk.ceylonpay.service;

import lk.ceylonpay.dto.AuthResponse;
import lk.ceylonpay.dto.LoginRequest;
import lk.ceylonpay.dto.RegisterRequest;
import lk.ceylonpay.entity.User;
import lk.ceylonpay.exception.InvalidCredentialsException;
import lk.ceylonpay.exception.UserAlreadyExistsException;
import lk.ceylonpay.repository.UserRepository;
import lk.ceylonpay.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByPhone(request.phone()).isPresent()) {
            throw new UserAlreadyExistsException("Phone number already registered");
        }
        if (userRepository.findByNic(request.nic()).isPresent()) {
            throw new UserAlreadyExistsException("NIC already registered");
        }

        User user = new User();
        user.setName(request.name());
        user.setPhone(request.phone());
        user.setNic(request.nic());
        user.setPassword(passwordEncoder.encode(request.password()));

        User saved = userRepository.save(user);
        String token = jwtUtil.generateToken(saved.getId());

        return new AuthResponse(token, saved.getId(), saved.getName());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByPhone(request.phone())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid phone number or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new InvalidCredentialsException("Invalid phone number or password");
        }

        String token = jwtUtil.generateToken(user.getId());
        return new AuthResponse(token, user.getId(), user.getName());
    }

}
