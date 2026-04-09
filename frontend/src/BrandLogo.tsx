import { Box, Typography } from "@mui/material";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: compact ? 1 : 1.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: compact ? 34 : 42,
          height: compact ? 34 : 42,
          borderRadius: compact ? 2 : 2.5,
          display: "grid",
          placeItems: "center",
          bgcolor: "primary.main",
          color: "#0d0d0d",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            width: "70%",
            height: 2,
            backgroundColor: "rgba(13,13,13,0.58)",
            transform: "rotate(-35deg)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            width: "70%",
            height: 2,
            backgroundColor: "rgba(13,13,13,0.42)",
            transform: "rotate(35deg)",
          }}
        />
        <Typography sx={{ fontWeight: 800, fontSize: compact ? 13 : 15, letterSpacing: "0.06em" }}>XA</Typography>
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: compact ? 15 : 17, lineHeight: 1 }}>Xenon Auth</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.2 }}>Baryonic Identity Platform</Typography>
      </Box>
    </Box>
  );
}
