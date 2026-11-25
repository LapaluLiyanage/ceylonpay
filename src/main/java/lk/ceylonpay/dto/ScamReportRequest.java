package lk.ceylonpay.dto;

import jakarta.validation.constraints.Size;

public record ScamReportRequest(

        @Size(max = 500)
        String note

) {
}
