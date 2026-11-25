package lk.ceylonpay.util;

/** "Kasun Bandara Perera" -> "K. Perera". Enough to catch a wrong number, not enough to harvest names. */
public final class NameMask {

    private NameMask() {
    }

    public static String mask(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return "";
        }
        String[] parts = fullName.trim().split(" +");
        String initial = parts[0].substring(0, 1).toUpperCase() + ".";
        return parts.length == 1 ? initial : initial + " " + parts[parts.length - 1];
    }

}
