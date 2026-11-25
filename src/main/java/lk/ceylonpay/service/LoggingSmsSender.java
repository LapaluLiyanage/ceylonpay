package lk.ceylonpay.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Development sender: prints the message to the server log instead of texting it. Never use in production. */
@Component
@ConditionalOnProperty(name = "ceylonpay.sms.provider", havingValue = "log", matchIfMissing = true)
public class LoggingSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingSmsSender.class);

    @Override
    public void send(String phone, String message) {
        log.warn("[DEV SMS - not actually sent] to {}: {}", phone, message);
    }

}
