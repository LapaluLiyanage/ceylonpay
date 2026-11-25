package lk.ceylonpay.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NameMaskTest {

    @Test
    void keepsFirstInitialAndLastName() {
        assertThat(NameMask.mask("Kasun Perera")).isEqualTo("K. Perera");
        assertThat(NameMask.mask("  nimal  Kumara   Silva ")).isEqualTo("N. Silva");
    }

    @Test
    void singleNameBecomesJustAnInitial() {
        assertThat(NameMask.mask("Kasun")).isEqualTo("K.");
        assertThat(NameMask.mask("")).isEmpty();
        assertThat(NameMask.mask(null)).isEmpty();
    }

}
