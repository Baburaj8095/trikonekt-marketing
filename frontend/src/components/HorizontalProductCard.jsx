import { Box, Typography } from "@mui/material";
import SmartImage from "./SmartImage";


// Blinkit-accurate ROW (not a Card)
export default function HorizontalProductCard({
    title,
    image,
    rewardPct,
    onClick,
}) {
    return (
        <Box
            onClick={onClick}
            sx={{
                flex: "0 0 auto",
                width: 260,
                display: "flex",
                alignItems: "center",
                gap: 1.5 /* 12px */,
                py: 1 /* 8px */,
                cursor: onClick ? "pointer" : "default",
            }}
        >
            <Box
                sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 1 /* 8px */,
                    backgroundColor: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <SmartImage src={image} alt={title} type="thumb" />
            </Box>


            <Box sx={{ minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: 1.25,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {title}
                </Typography>


                <Typography fontSize={12} color="text.secondary" mt={0.5 /* 4px */}>
                    Earn up to {rewardPct}% rewards
                </Typography>
            </Box>
        </Box>
    );
}