import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg,#eef1f6,#dfe6f3)",
          borderRadius: 110,
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "radial-gradient(circle at 35% 30%, #5b9cff, #2b64d9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 220,
            fontWeight: 800,
            boxShadow: "inset 0 0 0 18px rgba(255,255,255,0.85)",
          }}
        >
          $
        </div>
      </div>
    ),
    size,
  );
}
