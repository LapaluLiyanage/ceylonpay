package lk.ceylonpay.service;

import lk.ceylonpay.dto.SafetySettingsRequest;
import lk.ceylonpay.dto.SafetySettingsResponse;
import lk.ceylonpay.entity.SafetySettings;
import lk.ceylonpay.exception.TransferBlockedException;
import lk.ceylonpay.repository.SafetySettingsRepository;
import lk.ceylonpay.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * The user's own protections: a self-freeze kill switch plus a daily limit and a night limit
 * (Sri Lanka time). These are limits the user sets on themselves, so they only ever make
 * transfers harder to send, never easier.
 */
@Service
public class SafetyService {

    static final int NIGHT_START_HOUR = 22;
    static final int NIGHT_END_HOUR = 6;

    private final SafetySettingsRepository settingsRepository;
    private final TransactionRepository transactionRepository;
    private final Clock clock;

    public SafetyService(SafetySettingsRepository settingsRepository,
                         TransactionRepository transactionRepository, Clock clock) {
        this.settingsRepository = settingsRepository;
        this.transactionRepository = transactionRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public SafetySettingsResponse get(String userId) {
        return toResponse(settingsRepository.findById(userId).orElse(new SafetySettings(userId)));
    }

    @Transactional
    public SafetySettingsResponse update(String userId, SafetySettingsRequest request) {
        SafetySettings settings = settingsRepository.findById(userId).orElse(new SafetySettings(userId));
        settings.setFrozen(request.frozen());
        settings.setDailyLimit(request.dailyLimit());
        settings.setNightLimit(request.nightLimit());
        return toResponse(settingsRepository.save(settings));
    }

    /** System-controlled: blocks this user's outgoing transfers while a scam report against them is open. */
    @Transactional
    public void setReviewHold(String userId, boolean hold) {
        SafetySettings settings = settingsRepository.findById(userId).orElse(new SafetySettings(userId));
        settings.setReviewHold(hold);
        settingsRepository.save(settings);
    }

    @Transactional(readOnly = true)
    public boolean isFrozen(String userId) {
        return settingsRepository.findById(userId).map(SafetySettings::isFrozen).orElse(false);
    }

    /** Throws {@link TransferBlockedException} if the sender's own settings forbid this transfer. */
    @Transactional(readOnly = true)
    public void checkOutgoing(String userId, String senderWalletId, BigDecimal amount) {
        SafetySettings settings = settingsRepository.findById(userId).orElse(null);
        if (settings == null) {
            return;
        }
        if (settings.isReviewHold()) {
            throw new TransferBlockedException("Your account is under review, so sending is paused. Contact support.");
        }
        if (settings.isFrozen()) {
            throw new TransferBlockedException("Your wallet is frozen. Unfreeze it in Safety to send money.");
        }

        BigDecimal nightLimit = settings.getNightLimit();
        if (nightLimit != null && isNight() && amount.compareTo(nightLimit) > 0) {
            throw new TransferBlockedException("Your night limit is Rs. " + nightLimit.setScale(2)
                    + " between " + NIGHT_START_HOUR + ":00 and 0" + NIGHT_END_HOUR + ":00.");
        }

        BigDecimal dailyLimit = settings.getDailyLimit();
        if (dailyLimit != null) {
            BigDecimal sentToday = transactionRepository.sumSentSince(senderWalletId, startOfTodayInServerZone());
            if (sentToday.add(amount).compareTo(dailyLimit) > 0) {
                throw new TransferBlockedException("This would pass your daily limit of Rs. "
                        + dailyLimit.setScale(2) + ". You have sent Rs. " + sentToday.setScale(2) + " today.");
            }
        }
    }

    private boolean isNight() {
        int hour = ZonedDateTime.now(clock).getHour();
        return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
    }

    /** Transaction timestamps are stored in the JVM's zone, so convert Colombo midnight into that zone. */
    private LocalDateTime startOfTodayInServerZone() {
        ZonedDateTime midnight = ZonedDateTime.now(clock).toLocalDate().atStartOfDay(clock.getZone());
        return midnight.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    private SafetySettingsResponse toResponse(SafetySettings s) {
        return new SafetySettingsResponse(s.isFrozen(), s.getDailyLimit(), s.getNightLimit(),
                NIGHT_START_HOUR, NIGHT_END_HOUR);
    }

}
