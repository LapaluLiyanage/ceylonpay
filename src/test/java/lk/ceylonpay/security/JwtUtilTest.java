package lk.ceylonpay.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private static final String SECRET =
            "sesVRBv8k9TpxvSqYrGyw0alAcdak6EwjIrjz8cuvyrtOMNLJUW9eI8gn97wK6KuSCLFRk1yuuU54M8Sp8YGVw==";

    @Test
    void extractsTheUserIdItGeneratedTheTokenFor() {
        JwtUtil jwtUtil = new JwtUtil(SECRET, 86_400_000L);

        String token = jwtUtil.generateToken("user-123");

        assertThat(jwtUtil.extractUserId(token)).isEqualTo("user-123");
    }

    @Test
    void aFreshlyGeneratedTokenIsValid() {
        JwtUtil jwtUtil = new JwtUtil(SECRET, 86_400_000L);

        String token = jwtUtil.generateToken("user-123");

        assertThat(jwtUtil.isTokenValid(token)).isTrue();
    }

    @Test
    void aMalformedTokenIsInvalidRatherThanThrowing() {
        JwtUtil jwtUtil = new JwtUtil(SECRET, 86_400_000L);

        assertThat(jwtUtil.isTokenValid("not-a-real-token")).isFalse();
    }

    @Test
    void anExpiredTokenIsInvalid() {
        JwtUtil jwtUtil = new JwtUtil(SECRET, -1_000L);

        String alreadyExpiredToken = jwtUtil.generateToken("user-123");

        assertThat(jwtUtil.isTokenValid(alreadyExpiredToken)).isFalse();
    }

}
