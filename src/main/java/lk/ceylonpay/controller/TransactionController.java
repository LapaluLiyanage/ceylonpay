package lk.ceylonpay.controller;

import lk.ceylonpay.dto.TransactionHistoryResponse;
import lk.ceylonpay.service.TransferService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransferService transferService;

    public TransactionController(TransferService transferService) {
        this.transferService = transferService;
    }

    @GetMapping
    public ResponseEntity<List<TransactionHistoryResponse>> getHistory(Authentication authentication) {
        return ResponseEntity.ok(transferService.getHistory(authentication.getName()));
    }

}
