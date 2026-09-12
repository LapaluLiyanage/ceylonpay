package lk.ceylonpay.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RegisterRequest(

        @NotBlank
        String name,

        @NotBlank
        @Pattern(regexp = "^(0|\\+94)7\\d{8}$", message = "must be a valid Sri Lankan mobile number")
        String phone,

        @NotBlank
        String nic,

        @NotBlank
        String password

) {
}
