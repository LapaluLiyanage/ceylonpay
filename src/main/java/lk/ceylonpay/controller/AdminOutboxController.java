package lk.ceylonpay.controller;

import lk.ceylonpay.dto.OutboxEventResponse;
import lk.ceylonpay.exception.WalletNotFoundException;
import lk.ceylonpay.service.OutboxPublisher;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Events that could not be delivered, and a way to try them again. ADMIN only. */
@RestController
@RequestMapping("/api/admin/outbox")
public class AdminOutboxController {

    private final OutboxPublisher outboxPublisher;

    public AdminOutboxController(OutboxPublisher outboxPublisher) {
        this.outboxPublisher = outboxPublisher;
    }

    /** How many events are waiting, and the ones that gave up. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> overview() {
        List<OutboxEventResponse> dead = outboxPublisher.deadEvents().stream().map(OutboxEventResponse::from).toList();
        return ResponseEntity.ok(Map.of("pending", outboxPublisher.pendingCount(), "dead", dead));
    }

    @PostMapping("/{eventId}/requeue")
    public ResponseEntity<Void> requeue(@PathVariable String eventId) {
        if (!outboxPublisher.requeue(eventId)) {
            throw new WalletNotFoundException("No dead event with that id");
        }
        return ResponseEntity.noContent().build();
    }

}
