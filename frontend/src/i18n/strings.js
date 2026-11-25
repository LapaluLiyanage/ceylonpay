// Scam-warning text in English, Sinhala and Tamil.
// These are fixed, reviewable translations on purpose: a warning that decides whether someone
// sends money should never be improvised. The Sinhala and Tamil should be read over by a fluent
// speaker before launch.

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'si', label: 'සිං', name: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்', name: 'தமிழ்' },
];

export const DEFAULT_LANGUAGE = 'en';

// Keyed by the reason codes the API returns. {usual} and {count} are filled from reason.params.
export const REASONS = {
  en: {
    FIRST_PAYMENT: 'You have never paid this number before.',
    UNUSUAL_AMOUNT: 'This is much more than you usually send (about Rs. {usual}).',
    LARGER_THAN_USUAL: 'This is more than you usually send (about Rs. {usual}).',
    MOST_OF_BALANCE: 'This sends almost all of your balance.',
    HALF_OF_BALANCE: 'This sends more than half of your balance.',
    RAPID_PAYMENTS: 'You have made several payments in the last few minutes.',
    LATE_NIGHT: 'It is the middle of the night, when scams are common.',
    NEW_RECEIVER: 'This account was opened very recently.',
    YOUNG_RECEIVER: 'This account is less than two weeks old.',
    MANY_SENDERS: 'This account received money from {count} different people today.',
    SEVERAL_SENDERS: 'This account received money from {count} different people today.',
    PASS_THROUGH: 'Money sent to this account is being passed on straight away.',
    REPORTED_SCAM: 'Other people have reported this account for taking their money in a scam.',
    REPORT_PENDING: 'Someone has reported this account and it is being reviewed.',
  },
  si: {
    FIRST_PAYMENT: 'ඔබ මීට පෙර මෙම අංකයට මුදල් ගෙවා නැත.',
    UNUSUAL_AMOUNT: 'මෙය ඔබ සාමාන්‍යයෙන් යවන මුදලට වඩා බෙහෙවින් වැඩිය (ආසන්න වශයෙන් රු. {usual}).',
    LARGER_THAN_USUAL: 'මෙය ඔබ සාමාන්‍යයෙන් යවන මුදලට වඩා වැඩිය (ආසන්න වශයෙන් රු. {usual}).',
    MOST_OF_BALANCE: 'මෙමගින් ඔබගේ ශේෂයෙන් බොහොමයක් යවයි.',
    HALF_OF_BALANCE: 'මෙමගින් ඔබගේ ශේෂයෙන් භාගයකට වඩා යවයි.',
    RAPID_PAYMENTS: 'ඔබ කෙටි වේලාවක් තුළ ගෙවීම් කිහිපයක් කර ඇත.',
    LATE_NIGHT: 'දැන් මධ්‍යම රාත්‍රියයි; වංචා බොහොමයක් සිදුවන්නේ මෙවැනි වෙලාවටය.',
    NEW_RECEIVER: 'මෙම ගිණුම විවෘත කර ඇත්තේ ඉතා මෑතදීය.',
    YOUNG_RECEIVER: 'මෙම ගිණුම සති දෙකකට වඩා අඩු කාලයක් පැරණිය.',
    MANY_SENDERS: 'අද මෙම ගිණුමට විවිධ පුද්ගලයන් {count} දෙනෙකුගෙන් මුදල් ලැබී ඇත.',
    SEVERAL_SENDERS: 'අද මෙම ගිණුමට විවිධ පුද්ගලයන් {count} දෙනෙකුගෙන් මුදල් ලැබී ඇත.',
    PASS_THROUGH: 'මෙම ගිණුමට ලැබෙන මුදල් වහාම වෙනත් අයට යවනු ලැබේ.',
    REPORTED_SCAM: 'මෙම ගිණුම වංචාවකින් මුදල් ගත් බවට අන් අය පැමිණිලි කර ඇත.',
    REPORT_PENDING: 'මෙම ගිණුම පිළිබඳව පැමිණිල්ලක් ලැබී ඇති අතර එය සමාලෝචනය වෙමින් පවතී.',
  },
  ta: {
    FIRST_PAYMENT: 'இந்த எண்ணுக்கு நீங்கள் இதற்கு முன் பணம் செலுத்தியதில்லை.',
    UNUSUAL_AMOUNT: 'இது நீங்கள் வழக்கமாக அனுப்பும் தொகையை விட மிகவும் அதிகம் (சுமார் ரூ. {usual}).',
    LARGER_THAN_USUAL: 'இது நீங்கள் வழக்கமாக அனுப்பும் தொகையை விட அதிகம் (சுமார் ரூ. {usual}).',
    MOST_OF_BALANCE: 'இது உங்கள் இருப்பில் கிட்டத்தட்ட முழுவதையும் அனுப்புகிறது.',
    HALF_OF_BALANCE: 'இது உங்கள் இருப்பில் பாதிக்கு மேல் அனுப்புகிறது.',
    RAPID_PAYMENTS: 'சில நிமிடங்களில் நீங்கள் பல கட்டணங்கள் செய்துள்ளீர்கள்.',
    LATE_NIGHT: 'இது நள்ளிரவு நேரம்; மோசடிகள் பெரும்பாலும் இந்த நேரத்தில் நடக்கின்றன.',
    NEW_RECEIVER: 'இந்தக் கணக்கு மிகச் சமீபத்தில்தான் திறக்கப்பட்டது.',
    YOUNG_RECEIVER: 'இந்தக் கணக்கு தொடங்கி இரண்டு வாரங்களுக்கும் குறைவாகிறது.',
    MANY_SENDERS: 'இன்று இந்தக் கணக்கிற்கு {count} வெவ்வேறு நபர்களிடமிருந்து பணம் வந்துள்ளது.',
    SEVERAL_SENDERS: 'இன்று இந்தக் கணக்கிற்கு {count} வெவ்வேறு நபர்களிடமிருந்து பணம் வந்துள்ளது.',
    PASS_THROUGH: 'இந்தக் கணக்கிற்கு வரும் பணம் உடனடியாக வேறு இடங்களுக்கு அனுப்பப்படுகிறது.',
    REPORTED_SCAM: 'இந்தக் கணக்கு மோசடி மூலம் பணம் பெற்றதாக மற்றவர்கள் புகாரளித்துள்ளனர்.',
    REPORT_PENDING: 'இந்தக் கணக்கு குறித்து புகார் வந்துள்ளது; அது மதிப்பாய்வில் உள்ளது.',
  },
};

export const UI = {
  en: {
    warnTitle: 'This transfer looks risky',
    holdTitle: 'We need to review this transfer first',
    understand: 'I understand the risk and want to send anyway',
    holdNote: 'No money leaves your wallet until a reviewer approves it. You can cancel any time before then.',
  },
  si: {
    warnTitle: 'මෙම මුදල් හුවමාරුව අවදානම්ය',
    holdTitle: 'මුලින්ම මෙම මුදල් හුවමාරුව සමාලෝචනය කිරීම අවශ්‍යයි',
    understand: 'මම අවදානම තේරුම් ගනිමි; කෙසේ වෙතත් යවන්න කැමතියි',
    holdNote:
      'සමාලෝචකයෙකු අනුමත කරන තෙක් ඔබගේ පසුම්බියෙන් කිසිදු මුදලක් පිටවන්නේ නැත. ඊට පෙර ඕනෑම වේලාවක අවලංගු කළ හැක.',
  },
  ta: {
    warnTitle: 'இந்தப் பரிமாற்றம் ஆபத்தானதாகத் தெரிகிறது',
    holdTitle: 'முதலில் இந்தப் பரிமாற்றத்தை நாங்கள் மதிப்பாய்வு செய்ய வேண்டும்',
    understand: 'ஆபத்தைப் புரிந்துகொள்கிறேன்; இருந்தாலும் அனுப்ப விரும்புகிறேன்',
    holdNote:
      'மதிப்பாய்வாளர் ஒப்புதல் அளிக்கும் வரை உங்கள் வாலட்டிலிருந்து பணம் வெளியேறாது. அதற்கு முன் எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்.',
  },
};

/** The reason in the chosen language, falling back to the server's English text if a code is unknown. */
export function reasonText(reason, lang) {
  const template = REASONS[lang]?.[reason.code];
  if (!template) return reason.message;
  const params = reason.params || {};
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? params[key] : match));
}

export function uiText(lang, key) {
  return UI[lang]?.[key] ?? UI[DEFAULT_LANGUAGE][key];
}
