package lk.ceylonpay.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumberTest {

    @Test
    void localAndInternationalFormsNormalizeToTheSameValue() {
        assertThat(PhoneNumber.normalize("0771234567")).isEqualTo("+94771234567");
        assertThat(PhoneNumber.normalize("+94771234567")).isEqualTo("+94771234567");
    }

    @Test
    void ignoresSpacesAndDashes() {
        assertThat(PhoneNumber.normalize("077 123 4567")).isEqualTo("+94771234567");
        assertThat(PhoneNumber.normalize("+94-77-123-4567")).isEqualTo("+94771234567");
    }

    @Test
    void rejectsInvalidNumbers() {
        assertThatThrownBy(() -> PhoneNumber.normalize("0112345678")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PhoneNumber.normalize("07712345")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PhoneNumber.normalize("abc")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PhoneNumber.normalize(null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(PhoneNumber.isValid("+94771234567")).isTrue();
        assertThat(PhoneNumber.isValid("12345")).isFalse();
    }

}
