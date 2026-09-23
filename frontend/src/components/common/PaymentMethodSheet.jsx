import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import AddCardOutlinedIcon from "@mui/icons-material/AddCardOutlined";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import { C, R, S } from "../../theme/tokens";

export default function PaymentMethodSheet({
  open,
  onClose,
  amount = 0,
  balances = {},
  onSelectMethod,
  busy = false,
}) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [selectedMethod, setSelectedMethod] = useState("add_money");

  const numAmount = Number(amount || 0);
  const selfPackageBal = Number(balances.selfPackage || balances.internal || 0);
  const packageCouponBal = Number(balances.packageCoupon || 0);
  const addMoneyBal = Number(balances.addMoney || 0);

  const methods = [
    {
      id: "internal",
      title: "Self Package Wallet",
      balance: selfPackageBal,
      icon: AccountBalanceWalletOutlinedIcon,
      available: selfPackageBal >= numAmount && numAmount > 0,
    },
    {
      id: "package_coupon",
      title: "Package Purchase Coupon",
      balance: packageCouponBal,
      icon: ConfirmationNumberOutlinedIcon,
      available: packageCouponBal >= numAmount && numAmount > 0,
    },
    {
      id: "add_money",
      title: "Add Money Pocket",
      balance: addMoneyBal,
      icon: AddCardOutlinedIcon,
      available: addMoneyBal >= numAmount && numAmount > 0,
    },
    {
      id: "manual",
      title: "Manual QR / UPI Deposit",
      balance: null,
      icon: QrCode2RoundedIcon,
      available: true,
    },
  ];

  const content = (
    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 18, color: C.text }}>
          Select Payment Method
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Close payment sheet"
          sx={{
            width: 32,
            height: 32,
            borderRadius: `${R.sm}px`,
            border: `1px solid ${C.border}`,
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {/* Amount Display */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: `${R.md}px`,
          bgcolor: C.surfaceSubtle,
          border: `1px solid ${C.border}`,
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: 13, color: C.textSec, fontWeight: 500 }}>
          Amount
        </Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: C.text }}>
          ₹ {numAmount.toLocaleString("en-IN")}
        </Typography>
      </Box>

      {/* Payment Options Radio List */}
      <RadioGroup
        value={selectedMethod}
        onChange={(e) => setSelectedMethod(e.target.value)}
        sx={{ display: "flex", flexDirection: "column", gap: 1 }}
      >
        {methods.map((m) => {
          const isSelected = selectedMethod === m.id;
          const IconComp = m.icon;

          return (
            <Box
              key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              sx={{
                p: 1.5,
                borderRadius: `${R.md}px`,
                border: isSelected ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                bgcolor: isSelected ? C.primaryLight : C.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 140ms ease",
                "&:hover": {
                  borderColor: isSelected ? C.primary : C.primaryBorder,
                },
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Radio
                  checked={isSelected}
                  value={m.id}
                  size="small"
                  sx={{ p: 0.5, color: C.primary }}
                />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    {m.title}
                  </Typography>
                  {m.balance !== null && (
                    <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>
                      Available: ₹ {m.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <IconComp sx={{ fontSize: 22, color: isSelected ? C.primary : C.textSec }} />
            </Box>
          );
        })}
      </RadioGroup>

      {/* Amount to pay summary & Actions */}
      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${C.border}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: C.textSec, fontWeight: 500 }}>
            Amount to pay
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: C.primary }}>
            ₹ {numAmount.toLocaleString("en-IN")}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onClose}
            sx={{
              borderRadius: `${R.button}px`,
              borderColor: C.border,
              color: C.text,
              fontWeight: 600,
              minHeight: 46,
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            fullWidth
            disabled={busy}
            onClick={() => onSelectMethod?.(selectedMethod)}
            sx={{
              borderRadius: `${R.button}px`,
              bgcolor: C.primary,
              fontWeight: 700,
              minHeight: 46,
            }}
          >
            Continue
          </Button>
        </Stack>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: `${R.modal}px`,
            borderTopRightRadius: `${R.modal}px`,
            bgcolor: C.surface,
            maxHeight: "85dvh",
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${R.modal}px`,
          bgcolor: C.surface,
        },
      }}
    >
      {content}
    </Dialog>
  );
}
