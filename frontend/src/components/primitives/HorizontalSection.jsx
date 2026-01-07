import { Box, Typography, Divider } from "@mui/material";


/**
* DESIGN SYSTEM PRIMITIVE
* - Flat only (no Card / no shadow)
* - Horizontal scroll only
* - Divider-based separation
* - Spacing scale: 4 / 8 / 12 only
*/
export default function HorizontalSection({
    title,
    items = [],
    onViewAll,
    renderItem,
}) {
    if (!items.length) return null;


    return (
        <Box sx={{ mb: 1.5 /* 12px */ }}>
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1 /* 8px */,
                }}
            >
                <Typography fontSize={18} fontWeight={700}>
                    {title}
                </Typography>


                {onViewAll && (
                    <Typography
                        fontSize={13}
                        fontWeight={600}
                        color="primary"
                        sx={{ cursor: "pointer" }}
                        onClick={onViewAll}
                    >
                        View All
                    </Typography>
                )}
            </Box>


            {/* Horizontal strip */}
            <Box
                sx={{
                    display: "flex",
                    gap: 1.5 /* 12px */,
                    overflowX: "auto",
                    pb: 0.5 /* 4px */,
                    WebkitOverflowScrolling: "touch",
                    "&::-webkit-scrollbar": { display: "none" },
                }}
            >
                {items.map((item, idx) => (
                    <Box key={idx} sx={{ flex: "0 0 auto" }}>
                        {renderItem(item)}
                        {idx !== items.length - 1 && (
                            <Divider sx={{ my: 0.5 /* 4px */ }} />
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}