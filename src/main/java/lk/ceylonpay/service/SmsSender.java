package lk.ceylonpay.service;

/**
 * Delivers a text message. The default implementation only logs, which is enough for development.
 * To send real messages, add a bean that implements this for your SMS provider (Dialog, Mobitel,
 * or a bulk-SMS gateway) and set {@code ceylonpay.sms.provider} to something other than {@code log}.
 */
public interface SmsSender {

    void send(String phone, String message);

}
