import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Stack,
  Button,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';

// Theme colors
const COLORS = {
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  secondary: "#a855f7",
  background: "#f1f5f9",
  surface: "#ffffff",
  text: "#0f172a",
  border: "#e5e7eb",
  error: "#ef4444",
};

const WalletScreen = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const walletBalance = {
    total: "₹45,230",
    available: "₹32,450",
    pending: "₹12,780",
  };

  const transactions = [
    {
      id: 1,
      type: "credit",
      amount: "+₹5,000",
      description: "Commission Received",
      date: "Today, 2:30 PM",
      icon: <TrendingUpIcon sx={{ color: COLORS.success }} />,
    },
    {
      id: 2,
      type: "debit",
      amount: "-₹2,500",
      description: "Member Purchase",
      date: "Yesterday, 11:45 AM",
      icon: <ShoppingCartIcon sx={{ color: COLORS.error }} />,
    },
    {
      id: 3,
      type: "credit",
      amount: "+₹8,200",
      description: "Level Bonus",
      date: "Mar 15, 2024",
      icon: <TrendingUpIcon sx={{ color: COLORS.success }} />,
    },
    {
      id: 4,
      type: "debit",
      amount: "-₹1,200",
      description: "Service Charge",
      date: "Mar 14, 2024",
      icon: <PaymentIcon sx={{ color: COLORS.error }} />,
    },
  ];

  return (
    <Box>
      {/* Wallet Balance Card */}
      <Card
        sx={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
          borderRadius: 3,
          mb: 3,
          boxShadow: "0 8px 32px rgba(14, 165, 233, 0.3)",
          border: "none",
        }}
      >
        <CardContent sx={{ p: 3, color: "white" }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: "rgba(255,255,255,0.2)",
              }}
            >
              <WalletIcon sx={{ fontSize: 24 }} />
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: "0.85rem" }}>
                Total Balance
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.8rem" }}>
                {walletBalance.total}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: "0.8rem" }}>
                Available
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {walletBalance.available}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ opacity: 0.8, fontSize: "0.8rem" }}>
                Pending
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {walletBalance.pending}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <Button
            variant="contained"
            fullWidth
            sx={{
              borderRadius: 2,
              py: 1.5,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: COLORS.success,
              "&:hover": {
                bgcolor: "#16a34a",
              },
            }}
          >
            Withdraw
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button
            variant="outlined"
            fullWidth
            sx={{
              borderRadius: 2,
              py: 1.5,
              textTransform: "none",
              fontWeight: 600,
              borderColor: COLORS.border,
              "&:hover": {
                borderColor: COLORS.primary,
                bgcolor: `${COLORS.primary}10`,
              },
            }}
          >
            Transfer
          </Button>
        </Grid>
      </Grid>

      {/* Transaction History */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: COLORS.text,
                fontSize: "1.1rem",
              }}
            >
              Transaction History
            </Typography>
          </Box>

          <List sx={{ py: 0 }}>
            {transactions.map((transaction, index) => (
              <React.Fragment key={transaction.id}>
                <ListItem sx={{ px: 3, py: 2 }}>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: `${transaction.type === 'credit' ? COLORS.success : COLORS.error}15`,
                        border: `1px solid ${transaction.type === 'credit' ? COLORS.success : COLORS.error}30`,
                      }}
                    >
                      {transaction.icon}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ fontWeight: 600, color: COLORS.text }}>
                        {transaction.description}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {transaction.date}
                      </Typography>
                    }
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      color: transaction.type === 'credit' ? COLORS.success : COLORS.error,
                      fontSize: "1rem",
                    }}
                  >
                    {transaction.amount}
                  </Typography>
                </ListItem>
                {index < transactions.length - 1 && <Divider sx={{ mx: 3 }} />}
              </React.Fragment>
            ))}
          </List>

          <Box sx={{ p: 3, pt: 2 }}>
            <Button
              variant="text"
              fullWidth
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: COLORS.primary,
                "&:hover": {
                  bgcolor: `${COLORS.primary}10`,
                },
              }}
            >
              View All Transactions
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default React.memo(WalletScreen);