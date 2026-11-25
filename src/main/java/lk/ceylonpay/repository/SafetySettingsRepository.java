package lk.ceylonpay.repository;

import lk.ceylonpay.entity.SafetySettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SafetySettingsRepository extends JpaRepository<SafetySettings, String> {
}
