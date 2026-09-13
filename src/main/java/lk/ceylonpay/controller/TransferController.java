package lk.ceylonpay.controller;

import jakarta.validation.Valid;
import lk.ceylonpay.dto.TransactionResponse;
import lk.ceylonpay.dto.TransferRequest;
import lk.ceylonpay.service.TransferService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> transfer(Authentication authentication,
                                                          @Valid @RequestBody TransferRequest request) {
        return ResponseEntity.ok(
                transferService.transfer(authentication.getName(), request.toPhone(), request.amount()));
    }

}
