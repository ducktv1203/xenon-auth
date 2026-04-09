import { Box, Typography } from "@mui/material";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 40 : 48;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: compact ? 1.2 : 1.8 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 3,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #ff6b35 0%, #ff8555 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(255, 107, 53, 0.4)",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width={size - 12}
          height={size - 12}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffe6cc" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Outer shield/hexagon shape */}
          <path
            d="M 32 8 L 52 18 L 52 38 Q 32 48 32 48 Q 12 38 12 38 L 12 18 Z"
            fill="url(#logoGrad)"
            opacity="0.95"
          />

          {/* Inner geometric design - lock symbol */}
          <g stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.9">
            {/* Lock body */}
            <rect x="26" y="28" width="12" height="12" rx="1" />
            
            {/* Lock shackle */}
            <path d="M 28 28 Q 28 18 32 18 Q 36 18 36 28" />
            
            {/* Lock dot */}
            <circle cx="32" cy="34" r="1.5" fill="#ffffff" />
          </g>

          {/* Accent rings */}
          <circle
            cx="32"
            cy="32"
            r="18"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
            opacity="0.25"
            strokeDasharray="3,2"
          />
        </svg>
      </Box>

      <Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: compact ? 16 : 18,
            lineHeight: 1,
            color: "#ff6b35",
            letterSpacing: "-0.01em",
          }}
        >
          Xenon Auth
        </Typography>
        <Typography
          sx={{
            fontSize: compact ? 11 : 12,
            color: "text.secondary",
            lineHeight: 1.2,
            letterSpacing: "0.02em",
          }}
        >
          Passwordless 2FA
        </Typography>
      </Box>
    </Box>
  );
}
