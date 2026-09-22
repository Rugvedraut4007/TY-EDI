import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, cx } from "./UI";

export function QRPanel({ value, title, subtitle, size = 150, caption }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white p-5 text-center">
      {title && <p className="text-sm font-semibold text-ink-800">{title}</p>}
      <div className="rounded-xl border border-ink-100 bg-white p-3">
        <QRCodeSVG value={value || "medsure"} size={size} level="M" includeMargin={false} />
      </div>
      {subtitle && <p className="break-all font-mono text-[11px] text-ink-500">{subtitle}</p>}
      {caption && <p className="text-xs text-ink-400">{caption}</p>}
    </div>
  );
}

/**
 * Scan (or type) a QR identifier. Uses the browser BarcodeDetector when
 * available and always falls back to manual entry.
 */
export function ScanInput({ onScan, placeholder = "e.g. MED-PCM20260901-001", buttonLabel = "Scan" }) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const submit = (code) => {
    const clean = (code ?? value).trim();
    if (!clean) return;
    onScan(clean);
    setValue("");
  };

  const stopCamera = () => {
    setScanning(false);
    setNote("");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    if (!("BarcodeDetector" in window)) {
      setNote("Camera scanning is not supported by this browser. Type or paste the QR code instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            const raw = codes[0].rawValue;
            stopCamera();
            submit(raw);
            return;
          }
        } catch (err) {
          /* keep scanning */
        }
        setTimeout(tick, 350);
      };
      tick();
    } catch (err) {
      setNote("Camera access was blocked. Type or paste the QR code instead.");
      setScanning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">⌨️</span>
          <input
            className="input pl-9"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <Button onClick={() => submit()}>{buttonLabel}</Button>
        <Button variant="outline" onClick={scanning ? stopCamera : startCamera}>
          {scanning ? "Stop camera" : "📷 Camera"}
        </Button>
      </div>

      {scanning && (
        <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-900">
          <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
          <div className={cx("pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70")} />
        </div>
      )}
      {note && <p className="text-xs font-medium text-amber-700">{note}</p>}
    </div>
  );
}
