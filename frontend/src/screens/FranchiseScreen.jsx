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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Book as BookIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  Help as HelpIcon,
  CalendarToday as CalendarIcon,
  PersonAdd as PersonAddIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

// Theme colors
const COLORS = {
  primary: "#2563eb",
  primaryDark: "#1e40af",
  success: "#22c55e",
  secondary: "#3b82f6",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  border: "#e5e7eb",
};

const FranchiseScreen = () => {
  const [expanded, setExpanded] = useState(false);

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const manualSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <PersonAddIcon sx={{ color: COLORS.primary }} />,
      content: [
        'Complete your profile setup',
        'Understand the compensation plan',
        'Learn about matrix placement',
        'Set up your referral links',
      ],
    },
    {
      id: 'monthly-entry',
      title: 'Monthly Entry Chart',
      icon: <CalendarIcon sx={{ color: COLORS.success }} />,
      content: [
        'Track monthly performance metrics',
        'Monitor team growth and commissions',
        'Review achievement levels',
        'Plan for upcoming months',
      ],
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      icon: <AssessmentIcon sx={{ color: COLORS.secondary }} />,
      content: [
        'Generate performance reports',
        'View commission statements',
        'Analyze team structure',
        'Track ROI and growth metrics',
      ],
    },
  ];

  const quickActions = [
    {
      title: 'Add New Member',
      icon: <PersonAddIcon sx={{ color: COLORS.success }} />,
      action: 'Add Member',
    },
    {
      title: 'View Reports',
      icon: <AssessmentIcon sx={{ color: COLORS.primary }} />,
      action: 'View Reports',
    },
    {
      title: 'Monthly Entry',
      icon: <CalendarIcon sx={{ color: COLORS.secondary }} />,
      action: 'Monthly Entry',
    },
  ];

  return (
    <Box>
      {/* Header Card */}
      <Card
        sx={{
          background: `linear-gradient(135deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 100%)`,
          borderRadius: 3,
          mb: 3,
          boxShadow: "0 8px 32px rgba(37, 99, 235, 0.3)",
          border: "none",
        }}
      >
        <CardContent sx={{ p: 3, color: "white", textAlign: "center" }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: "rgba(255,255,255,0.2)",
              mx: "auto",
              mb: 2,
            }}
          >
            <BookIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Franchise Manual
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Your guide to success in the network
          </Typography>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {quickActions.map((action, index) => (
          <Grid item xs={4} key={index}>
            <Card
              sx={{
                borderRadius: 2,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
                transition: "all 0.3s ease",
                cursor: "pointer",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                },
              }}
            >
              <CardContent sx={{ p: 2, textAlign: "center" }}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: `${Object.values(COLORS).find(color => color === action.icon.props.sx.color.replace('color: ', ''))}15`,
                    mx: "auto",
                    mb: 1,
                  }}
                >
                  {action.icon}
                </Avatar>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: COLORS.text,
                    fontSize: "0.8rem",
                    lineHeight: 1.2,
                  }}
                >
                  {action.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Manual Sections */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {manualSections.map((section) => (
            <Accordion
              key={section.id}
              expanded={expanded === section.id}
              onChange={handleAccordionChange(section.id)}
              sx={{
                border: 'none',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                '& .MuiAccordionSummary-root': {
                  px: 3,
                  py: 2,
                  '&:hover': {
                    bgcolor: `${COLORS.primary}05`,
                  },
                },
                '& .MuiAccordionDetails-root': {
                  px: 3,
                  pb: 2,
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: COLORS.primary }} />}
                aria-controls={`${section.id}-content`}
                id={`${section.id}-header`}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  {section.icon}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: COLORS.text,
                      fontSize: "1rem",
                    }}
                  >
                    {section.title}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <List sx={{ py: 0 }}>
                  {section.content.map((item, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: COLORS.primary,
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ color: COLORS.text }}>
                            {item}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>

      {/* Monthly Entry Form */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          border: `1px solid ${COLORS.border}`,
          mt: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: COLORS.text,
              mb: 2,
              fontSize: "1.1rem",
            }}
          >
            Monthly Entry Chart
          </Typography>

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Select Month</InputLabel>
              <Select
                label="Select Month"
                defaultValue=""
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="march-2024">March 2024</MenuItem>
                <MenuItem value="april-2024">April 2024</MenuItem>
                <MenuItem value="may-2024">May 2024</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Target Achievement"
              placeholder="Enter your monthly target"
              sx={{ borderRadius: 2 }}
            />

            <TextField
              fullWidth
              label="Team Size Goal"
              placeholder="Number of active members"
              type="number"
              sx={{ borderRadius: 2 }}
            />

            <Button
              variant="contained"
              fullWidth
              sx={{
                borderRadius: 2,
                py: 1.5,
                textTransform: "none",
                fontWeight: 600,
                bgcolor: COLORS.primary,
                "&:hover": {
                  bgcolor: COLORS.primaryDark,
                },
              }}
            >
              Submit Monthly Entry
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default React.memo(FranchiseScreen);