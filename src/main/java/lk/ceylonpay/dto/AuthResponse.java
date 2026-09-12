package lk.ceylonpay.dto;

public record AuthResponse(
        String token,
        String userId,
        String name
) {
}
