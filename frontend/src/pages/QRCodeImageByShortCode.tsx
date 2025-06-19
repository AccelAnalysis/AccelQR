import React, { useState } from "react";
import axios from "axios";

const QRCodeImageByShortCode: React.FC = () => {
  const [shortCode, setShortCode] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImgUrl(null);
    setError(null);
    if (!shortCode.trim()) {
      setError("Please enter a short code.");
      return;
    }
    try {
      // Assumes backend is served at the same origin or proxy
      const url = `/api/qrcodes/image-by-shortcode/${shortCode}`;
      setImgUrl(url);
    } catch (err: any) {
      setError("Could not generate QR code image.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: 24, background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <h2>QR Code Image by Short Code</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Enter short code"
          value={shortCode}
          onChange={e => setShortCode(e.target.value)}
          style={{ padding: 8, fontSize: 16, width: "70%", marginRight: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px", fontSize: 16 }}>Show Image</button>
      </form>
      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}
      {imgUrl && (
        <div style={{ textAlign: "center" }}>
          <img
            src={imgUrl}
            alt="QR Code"
            style={{ maxWidth: "100%", border: "1px solid #eee", padding: 8, borderRadius: 4 }}
            onError={() => setError("Image not found or server error.")}
          />
        </div>
      )}
      {shortCode && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a
            href={`/api/qrcodes/scans-csv/${shortCode}`}
            download={`scans_${shortCode}.csv`}
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              fontSize: 16,
              background: '#319795',
              color: '#fff',
              borderRadius: 4,
              textDecoration: 'none',
              marginTop: 8
            }}
          >
            Download Scan Stats (CSV)
          </a>
        </div>
      )}
    </div>
  );
};

export default QRCodeImageByShortCode;
