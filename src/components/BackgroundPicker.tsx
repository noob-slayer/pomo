import { useRef } from "react";
import { useSettings } from "../context/SettingsContext";

const MAX_DIMENSION = 1600;

function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("could not read image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function BackgroundPicker() {
  const { personalBg, setPersonalBg } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file);
      setPersonalBg(dataUrl);
    } catch {
      // unreadable file — silently ignore, background stays unchanged
    }
  };

  return (
    <div className="bg-picker">
      <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
        {personalBg ? "change background" : "upload background"}
      </button>
      {personalBg && (
        <button type="button" className="link-btn" onClick={() => setPersonalBg(null)}>
          clear
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
