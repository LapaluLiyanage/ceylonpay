package lk.ceylonpay.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ClockConfig {

    public static final ZoneId SRI_LANKA = ZoneId.of("Asia/Colombo");

    /** Injectable so "today" and "night" can be tested without waiting for real time. */
    @Bean
    public Clock clock() {
        return Clock.system(SRI_LANKA);
    }

}
