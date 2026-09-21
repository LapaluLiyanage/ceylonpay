package lk.ceylonpay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // powers the outbox publisher and nightly reconciliation job
public class CeylonPayApplication {

    public static void main(String[] args) {
        SpringApplication.run(CeylonPayApplication.class, args);
    }

}
