import { AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

export default function AppHeader() {
  return (
    <AppBar position="sticky" sx={{ bgcolor: "#145DA0" }}>
      <Toolbar>
        <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>TRIKONEKT</Typography>
        <IconButton color="inherit">
          <NotificationsNoneIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
