package lk.ceylonpay.service;

import lk.ceylonpay.entity.SafetySettings;
import lk.ceylonpay.exception.TransferBlockedException;
import lk.ceylonpay.repository.SafetySettingsRepository;
import lk.ceylonpay.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SafetyServiceTest {

    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");

    @Mock
    private SafetySettingsRepository settingsRepository;

    @Mock
    private TransactionRepository transactionRepository;

    private SafetyService serviceAt(String localTime) {
        Instant instant = LocalDateTime.parse("2026-03-10T" + localTime).atZone(COLOMBO).toInstant();
        return new SafetyService(settingsRepository, transactionRepository, Clock.fixed(instant, COLOMBO));
    }

    private SafetySettings settings() {
        SafetySettings s = new SafetySettings("user-1");
        lenient().when(settingsRepository.findById("user-1")).thenReturn(Optional.of(s));
        return s;
    }

    @Test
    void allowsTransferWhenNoSettingsExist() {
        when(settingsRepository.findById("user-1")).thenReturn(Optional.empty());

        assertThatCode(() -> serviceAt("12:00:00").checkOutgoing("user-1", "w1", new BigDecimal("999999")))
                .doesNotThrowAnyException();
    }

    @Test
    void blocksEverythingWhenFrozen() {
        settings().setFrozen(true);

        assertThatThrownBy(() -> serviceAt("12:00:00").checkOutgoing("user-1", "w1", new BigDecimal("1")))
                .isInstanceOf(TransferBlockedException.class)
                .hasMessageContaining("frozen");
    }

    @Test
    void nightLimitAppliesOnlyAtNight() {
        settings().setNightLimit(new BigDecimal("1000"));

        assertThatThrownBy(() -> serviceAt("23:30:00").checkOutgoing("user-1", "w1", new BigDecimal("5000")))
                .isInstanceOf(TransferBlockedException.class);
        assertThatThrownBy(() -> serviceAt("03:00:00").checkOutgoing("user-1", "w1", new BigDecimal("5000")))
                .isInstanceOf(TransferBlockedException.class);
        assertThatCode(() -> serviceAt("23:30:00").checkOutgoing("user-1", "w1", new BigDecimal("1000")))
                .doesNotThrowAnyException();
        assertThatCode(() -> serviceAt("12:00:00").checkOutgoing("user-1", "w1", new BigDecimal("5000")))
                .doesNotThrowAnyException();
    }

    @Test
    void dailyLimitCountsWhatWasAlreadySentToday() {
        settings().setDailyLimit(new BigDecimal("1000"));
        when(transactionRepository.sumSentSince(eq("w1"), any(LocalDateTime.class)))
                .thenReturn(new BigDecimal("800"));

        assertThatThrownBy(() -> serviceAt("12:00:00").checkOutgoing("user-1", "w1", new BigDecimal("300")))
                .isInstanceOf(TransferBlockedException.class)
                .hasMessageContaining("daily limit");
        assertThatCode(() -> serviceAt("12:00:00").checkOutgoing("user-1", "w1", new BigDecimal("200")))
                .doesNotThrowAnyException();
    }

}
