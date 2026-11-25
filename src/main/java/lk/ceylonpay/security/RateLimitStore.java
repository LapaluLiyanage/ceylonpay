package lk.ceylonpay.security;

/** Counts requests per key inside a fixed time window. */
public interface RateLimitStore {

    /** Records one request for the key and returns how many have been seen in the current window, this one included. */
    long increment(String key, long windowMillis);

}
