import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { msg } from '../i18n/strings';

/** True where the browser can read QR codes from the camera (Chrome and Edge on phones and desktops, mostly). */
export function canScanQr() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

/** Opens the camera and calls onResult with the text of the first QR code it sees. */
export function QrScanner({ onResult, onClose }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && !stopped) {
              stopped = true;
              onResult(codes[0].rawValue);
            }
          } catch {
            // A frame that cannot be read is not an error; try the next one.
          }
        }, 300);
      } catch {
        setError(msg('Could not open the camera. Allow camera access, or type the number instead.'));
      }
    }
    start();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <div style={{ marginTop: 16 }}>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ff7a5c' }}>{t(error)}</p>
      ) : (
        <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000' }} />
      )}
      <button
        type="button"
        onClick={onClose}
        style={{ marginTop: 10, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,.08)', color: '#f2f4ef', fontSize: 13 }}
      >
        {t('Close camera')}
      </button>
    </div>
  );
}
