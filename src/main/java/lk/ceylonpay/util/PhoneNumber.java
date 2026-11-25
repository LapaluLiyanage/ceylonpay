package lk.ceylonpay.util;

import java.util.regex.Pattern;

/**
 * Canonical form for Sri Lankan mobile numbers.
 *
 * <p>The same real number can be typed as {@code 0771234567} or {@code +94771234567}.
 * Everything that is stored or looked up uses the single canonical form
 * {@code +94771234567}, so one person can never end up with two accounts.</p>
 */
public final class PhoneNumber {

    private static final Pattern LOCAL = Pattern.compile("^07\\d{8}$");
    private static final Pattern INTERNATIONAL = Pattern.compile("^\\+947\\d{8}$");

    private PhoneNumber() {
    }

    /** Returns the canonical {@code +947XXXXXXXX} form, or throws if the input is not a valid mobile number. */
    public static String normalize(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("Phone number is required");
        }
        String cleaned = raw.replaceAll("[\\s-]", "");
        if (LOCAL.matcher(cleaned).matches()) {
            return "+94" + cleaned.substring(1);
        }
        if (INTERNATIONAL.matcher(cleaned).matches()) {
            return cleaned;
        }
        throw new IllegalArgumentException("Invalid Sri Lankan mobile number");
    }

    public static boolean isValid(String raw) {
        try {
            normalize(raw);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

}
