import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { timestampLabel } from '../components/Activity';
import { getBalance } from '../api/wallet';
import { transfer, riskCheck, requestTransferCode } from '../api/transfer';
import { lookupUser } from '../api/users';
import { useLanguage } from '../context/LanguageContext';
import { msg, reasonText } from '../i18n/strings';
import { ApiError } from '../api/client';
import { formatMoney, parseAmountInput } from '../utils/money';
import { digitsOnly, groupPhone, phoneError, toApiPhone, toDisplayPhone } from '../utils/phone';
import { QrScanner, canScanQr } from '../components/QrScanner';
import { parsePayLink } from '../utils/payLink';
import { AmountBox, Banner, Card, ErrorText, Label, OutlineButton, PageTitle, PhoneBox, PrimaryButton, C, display, mono } from '../components/ui';

const FAIL_COPY = {
  network: { title: msg("Transfer didn't go through"), label: msg('Try again') },
  notfound: { title: msg('No wallet on that number'), label: msg('Change the number') },
  blocked: { title: msg('Blocked by your safety settings'), label: msg('Open Safety') },
  balance: { title: msg('Not enough balance'), label: msg('Deposit money') },
};

const CHECK_NAME = msg('Check the name above is the person you mean to pay.');
const ALLOW_NOTE = msg("If it turns out to be a scam, report it from Activity straight away — money can only be recovered while it's still in the recipient's wallet.");
const WARN_NOTE = msg("If it is a scam, report it from Activity straight away — money can only be recovered while it's still in their wallet.");

function SummaryRow({ label, children, strong }) {
  const { t } = useLanguage();
  return (
    <>
      <span style={{ color: '#CFCAC2' }}>{t(label)}</span>
      <span style={{ textAlign: 'right', fontWeight: strong ? 600 : 400 }}>{children}</span>
    </>
  );
}

export default function Transfer() {
  const navigate = useNavigate();
  const { lang, t, locale } = useLanguage();
  const [balance, setBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  // A pay link (from a QR code) opens this page with the number and maybe the amount filled in.
  const [linked] = useState(() => parsePayLink(`${window.location.origin}/transfer${window.location.search}`));
  const [phone, setPhone] = useState(linked?.phone || '');
  const [amount, setAmount] = useState(linked?.amount || '');
  const [scanning, setScanning] = useState(false);
  const [phoneErr, setPhoneErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [stage, setStage] = useState('form');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failKind, setFailKind] = useState(null);
  const [result, setResult] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [changed, setChanged] = useState(false);
  const [ack, setAck] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpNeeded, setOtpNeeded] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [devCode, setDevCode] = useState('');

  useEffect(() => {
    getBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => setBalanceError(true));
  }, []);

  function handleScan(text) {
    setScanning(false);
    const found = parsePayLink(text);
    if (!found) {
      setPhoneErr(msg("That code isn't a CeylonPay payment code."));
      return;
    }
    setPhone(found.phone);
    if (found.amount) setAmount(found.amount);
    setPhoneErr('');
  }

  function resetOtp() {
    setOtpSent(false);
    setOtpNeeded(true);
    setOtpCode('');
    setOtpErr('');
    setDevCode('');
  }

  async function sendCode() {
    setOtpErr('');
    try {
      const sent = await requestTransferCode(toApiPhone(draft.phoneDigits), draft.amountValue);
      setOtpNeeded(sent.required);
      setOtpSent(true);
      setDevCode(sent.devCode || '');
    } catch (err) {
      setOtpErr(err.message);
    }
  }

  async function reviewTransfer(e) {
    e.preventDefault();
    if (checking) return;
    const pe = phoneError(phone);
    const parsed = parseAmountInput(amount);
    if (pe || parsed.error) {
      setPhoneErr(pe);
      setAmountErr(parsed.error || '');
      return;
    }
    setPhoneErr('');
    setAmountErr('');
    setChecking(true);
    try {
      // Name check: show who owns this number before any money moves.
      const owner = await lookupUser(toApiPhone(phone));
      const risk = await riskCheck(toApiPhone(phone), parsed.value);
      setAck(false);
      setChanged(false);
      resetOtp();
      setDraft({ phoneDigits: phone, amountValue: parsed.value, recipientName: owner.name, risk });
      setStage('confirm');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPhoneErr(msg('Nobody on CeylonPay has this number. Check it and try again.'));
      } else {
        setPhoneErr(msg("Couldn't check that number. Try again in a moment."));
      }
    } finally {
      setChecking(false);
    }
  }

  async function confirmTransfer() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await transfer(toApiPhone(draft.phoneDigits), draft.amountValue, draft.risk?.outcome === 'WARN' && ack, otpNeeded ? otpCode : null);
      setResult(data);
      setBalance(data.newBalance);
      setStage('sent');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'INVALID_OTP' || err.code === 'OTP_REQUIRED')) {
        // Stay on the confirm screen: the code was wrong, expired or missing.
        setOtpErr(err.message);
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        // The risk picture changed since the preview: show the new warning and ask again.
        try {
          const risk = await riskCheck(toApiPhone(draft.phoneDigits), draft.amountValue);
          setDraft((d) => ({ ...d, risk }));
          setAck(false);
          setChanged(true);
          resetOtp();
          return;
        } catch {
          setFailKind('network');
          setStage('failed');
          return;
        }
      }
      if (err instanceof ApiError && err.status === 403) {
        setBlockedMessage(err.message);
        setFailKind('blocked');
      } else if (err instanceof ApiError && err.status === 404) setFailKind('notfound');
      else if (err instanceof ApiError && err.status === 400) setFailKind('balance');
      else setFailKind('network');
      setStage('failed');
    } finally {
      setBusy(false);
    }
  }

  const balanceAfter = draft ? balance - draft.amountValue : balance;
  const fail = failKind ? FAIL_COPY[failKind] : null;
  const failBody =
    failKind === 'blocked'
      ? blockedMessage
      : failKind === 'notfound'
        ? t("{phone} isn't registered with CeylonPay. Check the number, or ask them to sign up first.", { phone: toDisplayPhone(draft?.phoneDigits) })
        : failKind === 'balance'
          ? t('You need {short} more to send {amount}. Deposit first, then send.', { short: formatMoney((draft?.amountValue || 0) - balance), amount: formatMoney(draft?.amountValue || 0) })
          : t("We couldn't reach the server, so the transfer was never sent. Try again in a moment.");

  function failPrimaryAction() {
    if (failKind === 'balance') navigate('/deposit');
    else if (failKind === 'blocked') navigate('/safety');
    else if (failKind === 'notfound') setStage('form');
    else confirmTransfer();
  }

  const outcome = draft?.risk?.outcome;
  const sendDisabled = busy || (outcome === 'WARN' && (!ack || !otpSent || (otpNeeded && otpCode.length !== 6)));
  const held = result?.status === 'PENDING_REVIEW';

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        {stage === 'form' && (
          <form onSubmit={reviewTransfer} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PageTitle sub="You'll review everything before it leaves your wallet.">Send money</PageTitle>
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Send to</Label>
              <PhoneBox
                height={56}
                fontSize={17}
                bordered={false}
                tone={C.surface2}
                value={groupPhone(phone)}
                onChange={(e) => {
                  setPhone(digitsOnly(e.target.value));
                  setPhoneErr('');
                }}
                aria-label="Recipient phone number"
              />
              <ErrorText>{phoneErr}</ErrorText>
              {canScanQr() && !scanning && (
                <OutlineButton type="button" onClick={() => setScanning(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span aria-hidden="true" style={{ width: 16, height: 16, border: '2px solid #F4EEE8', borderRadius: 4 }} />
                  {t('Scan a QR code')}
                </OutlineButton>
              )}
              {scanning && <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />}
              <Label style={{ marginTop: 4 }}>Amount</Label>
              <AmountBox
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountErr('');
                }}
                aria-label="Amount in rupees"
              />
              <ErrorText>{amountErr}</ErrorText>
              {balanceError ? (
                <ErrorText>Couldn&apos;t load your balance — refresh the page to try again.</ErrorText>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{t('Available')}</span>
                  <b>{formatMoney(balance)}</b>
                </div>
              )}
            </Card>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton type="submit" disabled={balanceError || checking} style={{ flex: 1 }}>
                {checking ? 'Checking number…' : 'Review transfer'}
              </PrimaryButton>
              <OutlineButton type="button" height={56} onClick={() => navigate('/dashboard')} style={{ fontSize: 15, padding: '0 20px' }}>
                Cancel
              </OutlineButton>
            </div>
          </form>
        )}

        {stage === 'confirm' && draft && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...mono, fontSize: 12, color: C.muted }}>{t('STEP 2 OF 2 · CONFIRM')}</span>
              <OutlineButton height={36} onClick={() => setStage('form')} style={{ fontSize: 13, padding: '0 14px' }}>
                Edit
              </OutlineButton>
            </div>
            <Card tone="dark" style={{ borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontSize: 13, color: '#CFCAC2' }}>{t("You're sending")}</span>
              <span style={{ ...display, fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{formatMoney(draft.amountValue)}</span>
              <div style={{ background: C.surface, color: C.text, borderRadius: 20, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: C.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                  {(draft.recipientName || '?')[0]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>{t('Paying')}</div>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{draft.recipientName}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 13.5 }}>
                <SummaryRow label="Phone"><span style={{ ...mono, fontSize: 13 }}>{toDisplayPhone(draft.phoneDigits)}</span></SummaryRow>
                <SummaryRow label="Fee">Rs. 0.00</SummaryRow>
                <SummaryRow label="Balance after" strong>{formatMoney(balanceAfter)}</SummaryRow>
              </div>
            </Card>

            {changed && (
              <Banner tone="warn">Something changed since you reviewed this transfer. Check the updated reasons below and confirm again.</Banner>
            )}

            {outcome === 'ALLOW' && (
              <Card style={{ borderRadius: 20, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.5, color: C.soft, display: 'flex', gap: 12 }}>
                <span aria-hidden="true" style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: '#2F7A4E', marginTop: 5 }} />
                <span>{t(CHECK_NAME)} {t(ALLOW_NOTE)}</span>
              </Card>
            )}

            {outcome === 'WARN' && (
              <Card tone="warn" role="alert" style={{ borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#D9822B', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>!</span>
                  <b style={{ fontSize: 15.5 }}>{t('warnTitle')}</b>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>
                  {draft.risk.reasons.map((r) => (
                    <li key={r.code}>{reasonText(r, lang)}</li>
                  ))}
                </ul>
                <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                  {t(CHECK_NAME)} {t(WARN_NOTE)}
                </span>
                <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: C.surface, color: C.text, borderRadius: 14, padding: 12, cursor: 'pointer', fontSize: 13.5, lineHeight: 1.4, fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => {
                      setAck(e.target.checked);
                      // Ticking "send anyway" asks for the code right away (a no-op when codes are off).
                      if (e.target.checked && !otpSent) sendCode();
                    }}
                    style={{ width: 22, height: 22, accentColor: C.accent, margin: 0, flex: 'none' }}
                  />
                  <span>{t('understand')}</span>
                </label>
                {ack && !otpSent && otpErr && (
                  <OutlineButton type="button" height={40} onClick={sendCode} style={{ alignSelf: 'flex-start', fontSize: 13 }}>
                    {t('otpSend')}
                  </OutlineButton>
                )}
                {ack && otpSent && otpNeeded && (
                  <div style={{ background: C.surface, color: C.text, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Label htmlFor="transfer-otp">{t('otpEnter')}</Label>
                    <input
                      id="transfer-otp"
                      className="cp-field"
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setOtpErr('');
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="••••••"
                      style={{ height: 54, borderRadius: 14, background: C.surface2, padding: '0 16px', ...mono, fontSize: 22, letterSpacing: '.5em' }}
                    />
                    {devCode && <span style={{ ...mono, fontSize: 12, color: C.muted }}>Dev code: {devCode}</span>}
                    <button type="button" onClick={sendCode} style={{ alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', color: C.soft }}>
                      {t('otpResend')}
                    </button>
                  </div>
                )}
                {otpErr && <ErrorText>{otpErr}</ErrorText>}
              </Card>
            )}

            {outcome === 'HOLD' && (
              <Card tone="error" role="alert" style={{ borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#B3261E', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>‖</span>
                  <b style={{ fontSize: 15.5 }}>{t('holdTitle')}</b>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>
                  {draft.risk.reasons.map((r) => (
                    <li key={r.code}>{reasonText(r, lang)}</li>
                  ))}
                </ul>
                <span style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600 }}>{t('holdNote')}</span>
                <span style={{ fontSize: 12.5 }}>{t(CHECK_NAME)}</span>
              </Card>
            )}

            <PrimaryButton knob="↗" height={58} onClick={confirmTransfer} disabled={sendDisabled}>
              {busy ? 'Sending…' : outcome === 'HOLD' ? 'Submit for review' : t('Send {amount}', { amount: formatMoney(draft.amountValue) })}
            </PrimaryButton>
          </>
        )}

        {stage === 'sent' && result && draft && (
          <>
            <Card tone="dark" style={{ borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: held ? '#D9822B' : '#2F7A4E', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700 }} aria-hidden="true">
                {held ? '‖' : '✓'}
              </span>
              <span style={{ ...display, fontSize: 24, lineHeight: 1.2, textTransform: 'uppercase' }}>
                {held ? t('Held for review {amount}', { amount: formatMoney(result.amount) }) : t('Sent {amount}', { amount: formatMoney(result.amount) })}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
                {t('to {name} · {phone} · {time}', { name: draft.recipientName, phone: toDisplayPhone(draft.phoneDigits), time: timestampLabel(result.timestamp, locale) })}
              </span>
              {held && (
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: '#DDD8D0' }}>
                  {t("Nothing has left your wallet yet. We'll move the money once a reviewer approves it. You can cancel it from Activity.")}
                </span>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: 14, fontSize: 13.5 }}>
                <span style={{ opacity: 0.75 }}>{t('Reference')}</span>
                <span style={{ textAlign: 'right', ...mono, fontSize: 12.5, wordBreak: 'break-all' }}>{result.transactionId}</span>
                <span style={{ opacity: 0.75 }}>{t('New balance')}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(result.newBalance)}</span>
              </div>
            </Card>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton knob={null} onClick={() => navigate('/history')} style={{ flex: 1 }}>
                See activity
              </PrimaryButton>
              <OutlineButton height={56} onClick={() => navigate('/dashboard')} style={{ flex: 1, fontSize: 15 }}>
                Back to wallet
              </OutlineButton>
            </div>
          </>
        )}

        {stage === 'failed' && fail && (
          <>
            <Card tone="error" role="alert" style={{ borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: '#B3261E', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700 }} aria-hidden="true">!</span>
              <span style={{ ...display, fontSize: 24, lineHeight: 1.2, textTransform: 'uppercase' }}>{t(fail.title)}</span>
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>{failBody}</span>
              <span style={{ ...mono, fontSize: 12.5, opacity: 0.8 }}>{t('Nothing left your wallet. Balance {balance}', { balance: formatMoney(balance) })}</span>
            </Card>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton knob={null} onClick={failPrimaryAction} disabled={busy} style={{ flex: 1 }}>
                {fail.label}
              </PrimaryButton>
              <OutlineButton height={56} onClick={() => navigate('/dashboard')} style={{ flex: 1, fontSize: 15 }}>
                Back to wallet
              </OutlineButton>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
