import React, { useEffect, useState } from "react";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import giftCardService from "../../services/giftCard/GiftCardService";

const UI = {
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  onPrimary: "#ffffff",
};

function GiftCardItem({ card, onPurchase }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: UI.surface,
        border: `1px solid ${UI.border}`,
        boxShadow: "none",
        minWidth: 160,
        width: 160,
        flexShrink: 0,
        scrollSnapAlign: "start",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          height: 100,
          bgcolor: card.bgColor || UI.primary,
          color: card.textColor || UI.onPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          position: "relative",
        }}
      >
        <Typography variant="h6" fontWeight="bold" textAlign="center">
          {card.brand}
        </Typography>
        {card.discountPercent && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0,0,0,0.6)",
              color: "#fff",
              px: 0.8,
              py: 0.3,
              borderRadius: 1,
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            {card.discountPercent}% OFF
          </Box>
        )}
      </Box>
      <CardContent sx={{ p: 1.5, flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Typography sx={{ fontSize: 12, color: UI.textMuted, mb: 1, flexGrow: 1 }}>
          {card.description}
        </Typography>
        <Button
          fullWidth
          variant="contained"
          onClick={() => onPurchase(card)}
          startIcon={<CardGiftcardRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            borderRadius: 1.8,
            textTransform: "none",
            fontWeight: 700,
            fontSize: 11,
            bgcolor: UI.primary,
            color: UI.onPrimary,
            boxShadow: "none",
            minWidth: 0,
            px: 0.8,
            "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
          }}
        >
          View Cards
        </Button>
      </CardContent>
    </Card>
  );
}

export default function GiftCardCarousel() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchCards() {
      try {
        const availableCards = await giftCardService.getAvailableCards();
        setCards(availableCards);
      } catch (error) {
        console.error("Failed to fetch gift cards", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCards();
  }, []);

  const handlePurchaseClick = (card) => {
    setSelectedCard(card);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedCard(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress size={24} sx={{ color: UI.primary }} />
      </Box>
    );
  }

  if (cards.length === 0) {
    return (
      <Typography sx={{ fontSize: 12, color: UI.textMuted, p: 2, textAlign: "center" }}>
        No gift cards available at the moment.
      </Typography>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          overflowX: "auto",
          overflowY: "hidden",
          width: "100%",
          pb: 0.5,
          scrollBehavior: "smooth",
          scrollSnapType: "x proximity",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: alpha(UI.primary, 0.22),
            borderRadius: 999,
          },
        }}
      >
        {cards.map((card) => (
          <GiftCardItem key={card.id} card={card} onPurchase={handlePurchaseClick} />
        ))}
      </Box>

      {/* Purchase Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        {selectedCard && (
          <>
            <DialogTitle sx={{ fontWeight: "bold", fontSize: 16 }}>
              {selectedCard.brand} Gift Card
            </DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ fontSize: 13, color: UI.textMuted, mb: 2 }}>
                {selectedCard.description}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: "bold", mb: 1 }}>
                Select Amount
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {selectedCard.denominations.map((amount) => (
                  <Button
                    key={amount}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      borderColor: UI.primary,
                      color: UI.primary,
                      fontWeight: "bold",
                    }}
                  >
                    ₹{amount}
                  </Button>
                ))}
              </Box>
              <Box sx={{ mt: 2, p: 1.5, bgcolor: alpha(UI.primary, 0.05), borderRadius: 2 }}>
                <Typography sx={{ fontSize: 12, color: UI.text }}>
                  Validity: <b>{selectedCard.validityDays} Days</b>
                </Typography>
                <Typography sx={{ fontSize: 12, color: UI.text }}>
                  Discount: <b>{selectedCard.discountPercent}% OFF</b>
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={handleCloseDialog} sx={{ color: UI.textMuted }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                sx={{ bgcolor: UI.primary, color: UI.onPrimary }}
                onClick={() => {
                  alert("Proceed to payment flow with selected amount");
                  handleCloseDialog();
                }}
              >
                Proceed
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
