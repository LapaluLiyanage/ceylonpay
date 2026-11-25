package lk.ceylonpay.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record OtpVerifyRequest(

        @NotBlank
        @Pattern(regexp = "^[0-9]{6}$", message = "must be 6 digits")
        String code

) {
}
