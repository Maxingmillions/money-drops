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
          background: "linear-gradient(160deg,#1a0b3d,#0b0620)",
          borderRadius: 110,
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "radial-gradient(circle at 35% 30%, #3b1d7a, #15092f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#14f195",
            fontSize: 220,
            fontWeight: 800,
            boxShadow: "inset 0 0 0 18px #9945ff",
          }}
        >
          $
        </div>
      </div>
    ),
    size,
  );
}
