package lk.ceylonpay.dto;

import jakarta.validation.constraints.NotBlank;

/** {@code decision} is {@code UPHOLD} (it was a scam: recover the money) or {@code DISMISS}. */
public record ResolveReportRequest(

        @NotBlank
        String decision

) {
}
