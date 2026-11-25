package lk.ceylonpay.dto;

/** What a sender may see about a recipient before paying: a shortened name, not the full record. */
public record UserLookupResponse(String name, String phone) {
}
